export class Value {
    constructor(initValue, printMapping) {
        this._value = initValue;
        this._printMapping = printMapping;
        this._observers = [];
    }

    set value(value) {
        if (this._value === value) {
            return;
        }
        this._value = value;
        let index = this._observers.length;
        while (--index > -1) {
            this._observers[index](this);
        }
    }

    get value() {
        return this._value;
    }

    parse(string) {
        const value = this._printMapping.parse(string);
        if (null !== value) {
            this.value = value;
        }
    }

    print() {
        return this._printMapping.print(this._value);
    }

    addObserver(observer) {
        this._observers.push(observer);
    }

    removeObserver(observer) {
        const index = this._observers.indexOf(observer) | 0;
        if (-1 !== index) {
            this._observers.splice(index, 1);
        }
    }

    toString() {
        return `{Value '${this.print()}'`;
    }

    dispose() {
        this._observers = null;
    }
}

export class PrintMapping {
    constructor(parse, print) {
        this.parse = parse;
        this.print = print;
    }
}

PrintMapping.Any = new PrintMapping(string => string, value => value);
PrintMapping.Linear = (min, max) => new PrintMapping(
    string => {
        const value = parseFloat(string);
        if (isNaN(value)) return null;
        if (value < min) return min;
        else if (value > max) return max;
        else return value;
    },
    value => `${value}`
);
PrintMapping.LinearInt = (min, max) => {
    const mapping = PrintMapping.Linear(Math.round(min), Math.round(max));
    return new PrintMapping(string => {
        const value = mapping.parse(string);
        return null === value ? null : Math.round(value);
    }, mapping.print);
};
PrintMapping.PositiveInteger = PrintMapping.LinearInt(0, Number.MAX_SAFE_INTEGER);
PrintMapping.Boolean = new PrintMapping(string => -1 < ["true", "on", "1", "yes"].indexOf(string.toLowerCase()),
    value => value ? "On" : "Off");