import {clamp} from "./standard.js";

export class Linear {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }

    y(x) {
        return this.min + x * (this.max - this.min);
    }

    x(y) {
        return (y - this.min) / (this.max - this.min);
    }

    serialise() {
        return {type: "linear", min: this.min, max: this.max};
    }
}

Linear.Identity = new Linear(0.0, 1.0);
Linear.Bipolar = new Linear(-1.0, 1.0);
Linear.Percent = new Linear(0, 100);

export class LinearInt {
    constructor(min, max) {
        this.min = min | 0;
        this.max = max | 0;
        this.ran = this.max - this.min;
    }

    y(x) {
        return this.min + Math.round(x * this.ran);
    }

    x(y) {
        return (y - this.min) / this.ran;
    }

    serialise() {
        return {type: "linear-int", min: this.min, max: this.max};
    }
}

export class Exp {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }

    y(x) {
        return this.min * Math.exp(x * Math.log(this.max / this.min));
    }

    x(y) {
        return Math.log(y / this.min) / Math.log(this.max / this.min);
    }

    serialise() {
        return {type: "exp", min: this.min, max: this.max};
    }
}

export class Bool {
    y(x) {
        return x >= 0.5;
    }

    x(y) {
        return y ? 1.0 : 0.0;
    }

    serialise() {
        return {type: "bool"};
    }
}

Bool.Default = new Bool();

export const deserialiseMapping = data => {
    switch (data.type) {
        case "linear":
            return new Linear(data.min, data.max);
        case "linear-int":
            return new LinearInt(data.min, data.max);
        case "exp":
            return new Exp(data.min, data.max);
        case "bool":
            return Bool.Default;
    }
};

// A proper level mapping based on db = a-b/(x+c) where x is unipolar [0,1]
// Solved in Maxima: solve([min=a-b/c,max=a-b/(1+c),mid=a-b/(1/2+c)],[a,b,c]);
export class Level {
    // min - The lowest decibel value [0.0]
    // mid - The decibel value in the center [0.5]
    // max - The highest decibel value [1.0]
    constructor(min, mid, max) {
        this.min = min;
        this.max = max;

        const min2 = min * min;
        const max2 = max * max;
        const mid2 = mid * mid;
        const tmp0 = min + max - 2 * mid;
        const tmp1 = max - mid;
        this.a = ((2 * max - mid) * min - mid * max) / tmp0;
        this.b = (tmp1 * min2 + (mid2 - max2) * min + mid * max2 - mid2 * max)
            / (min2 + (2 * max - 4 * mid) * min + max2 - 4 * mid * max + 4 * mid2);
        this.c = -tmp1 / tmp0;
    }

    y(x) {
        if (0.0 >= x) {
            return Number.NEGATIVE_INFINITY; // in order to get a true zero gain
        }
        if (1.0 <= x) {
            return this.max;
        }
        return this.a - this.b / (x + this.c);
    }

    x(y) {
        if (this.min >= y) {
            return 0.0;
        }
        if (this.max <= y) {
            return 1.0;
        }
        return -this.b / (y - this.a) - this.c;
    }
}

Level.DEFAULT = new Level(-72.0, -12.0, 0.0);

export class PrintMapping {
    static create(output, input) {
        input = input || PrintMapping.DEFAULT_INPUT;
        return new PrintMapping(output, input);
    }

    constructor(output, input) {
        this.output = output;
        this.input = input;
    }
}

PrintMapping.DEFAULT_INPUT = ((mapping, text) => {
    if (text.includes("%")) {
        return mapping.y(parseFloat(text) / 100.0);
    }
    const value = parseFloat(text);
    if (isNaN(value)) {
        return NaN;
    }
    return mapping.y(clamp(0.0, 1.0, mapping.x(value)));
});

PrintMapping.DEFAULT_BIPOLAR_INPUT = ((mapping, text) => {
    const float = parseFloat(text);
    if (isNaN(float)) {
        return NaN;
    }
    return mapping.y(clamp(0.0, 1.0, float / 200.0 + 0.5));
});

export const NoFloat = PrintMapping.create((mapping, unipolar) => mapping.y(unipolar).toFixed(0));
export const OneFloat = PrintMapping.create((mapping, unipolar) => mapping.y(unipolar).toFixed(1));
export const TwoFloats = PrintMapping.create((mapping, unipolar) => mapping.y(unipolar).toFixed(2));
export const ThreeFloats = PrintMapping.create((mapping, unipolar) => mapping.y(unipolar).toFixed(3));
export const FourFloats = PrintMapping.create((mapping, unipolar) => mapping.y(unipolar).toFixed(4));
export const Percent = PrintMapping.create((mapping, unipolar) => (unipolar * 100.0).toFixed(1));
export const BipolarPercent = PrintMapping.create((mapping, unipolar) => ((unipolar - 0.5) * 200.0).toFixed(1), PrintMapping.DEFAULT_BIPOLAR_INPUT);
export const Cents = PrintMapping.create((mapping, unipolar) => (mapping.y(unipolar) * 1200.0).toFixed(1), PrintMapping.DEFAULT_BIPOLAR_INPUT);