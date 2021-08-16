import {ExpCurveAlgorithm} from "./neutrons.js";
import {clamp, emptyElement, uid} from "./standard.js";
import {SVG, SVGPathBuilder} from "./svg.js";

export const setAbsoluteXY = (element, x, y) => {
    element.style.position = "absolute";
    element.style.top = y + "px";
    element.style.left = x + "px";
    return element;
};

export const openInputFlyout = (parameter, x, y) => {
    const element = document.createElement("div");
    setAbsoluteXY(element, x, y);
    const inputElement = document.createElement("input");
    inputElement.setAttribute("type", "text");
    inputElement.className = "value-input";
    inputElement.onkeydown = event => event.stopImmediatePropagation();
    inputElement.onkeyup = event => {
        if (event.keyCode === 13) {
            parameter.parse(inputElement.value);
            inputElement.blur();
        }
        event.stopImmediatePropagation();
    };
    inputElement.onblur = ignore => element.remove();
    element.appendChild(inputElement);
    document.body.appendChild(element);
    window.requestAnimationFrame(() => inputElement.focus());
};

const createBackground = (width, height) => {
    const g = document.createElementNS(SVG.NAME_SPACE, "g");
    const styles = {fill: "#28E5FF"};
    g.appendChild(SVG.rect(0, 0, 1, 4, styles));
    g.appendChild(SVG.rect(1, 0, 3, 1, styles));
    g.appendChild(SVG.rect(width - 4, 0, 4, 1, styles));
    g.appendChild(SVG.rect(width - 1, 1, 1, 3, styles));
    g.appendChild(SVG.rect(width - 1, height - 4, 1, 4, styles));
    g.appendChild(SVG.rect(width - 4, height - 1, 3, 1, styles));
    g.appendChild(SVG.rect(0, height - 1, 4, 1, styles));
    g.appendChild(SVG.rect(0, height - 4, 1, 3, styles));
    return g;
};

const attachEvents = (root, focusElement, parameter) => {
    let unipolar = 0.0;
    let revertValue = 0.0;
    let position = 0;
    let lastMouseDown = 0.0;
    const onMouseMove = event => {
        const rect = root.getBoundingClientRect();
        const delta = (position - (event.clientY - rect.y)) * 0.004;
        parameter.unipolar = clamp(0.0, 1.0, unipolar + delta);
    };
    const onMouseUp = ignore => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = event => {
        if (event.keyCode === 27) {
            parameter.unipolar = revertValue;
            onMouseUp();
        }
    };
    const onMouseDown = event => {
        const rect = root.getBoundingClientRect();
        if (Date.now() - lastMouseDown < 200) {
            openInputFlyout(parameter, rect.x + rect.width, rect.y);
        } else {
            position = event.clientY - rect.y;
            unipolar = revertValue = parameter.unipolar;
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
            window.addEventListener("keydown", onKeyDown);
        }
        lastMouseDown = Date.now();
    };
    root.addEventListener("mousedown", onMouseDown);
    root.addEventListener("focusin", ignore => focusElement.style.visibility = "visible");
    root.addEventListener("focusout", ignore => focusElement.style.visibility = "hidden");
    root.addEventListener("keydown", event => {
        switch (event.keyCode) {
            case 8:
            case 46:
                parameter.reset();
                break;
        }
    });
};

export class ParameterKnob {
    constructor(parameter) {
        this.parameter = parameter;
        this.parameter.addCallback(ignore => this.update());
        this.svg = SVG.create(ParameterKnob.WIDTH, ParameterKnob.HEIGHT);
        this.svg.style.margin = "2px";
        this.background = createBackground(ParameterKnob.WIDTH, ParameterKnob.HEIGHT);
        this.background.style.visibility = "hidden";
        this.name = SVG.text(ParameterKnob.CIRCLE_X, 11, parameter.name, ParameterKnob.FONT_STYLE);
        this.print = SVG.text(ParameterKnob.CIRCLE_X, ParameterKnob.HEIGHT - 6, "Val Unit", ParameterKnob.FONT_STYLE);
        this.svg.appendChild(this.background);
        this.svg.appendChild(this.name);
        this.svg.appendChild(this.print);

        const attrPointer = {
            "stroke": "#25c7e2",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "fill": "none"
        };
        const attrDark = {
            "stroke": "#1f545c",
            "stroke-width": "2",
            "stroke-linecap": "butt",
            "fill": "none"
        };
        const attrBright = {
            "stroke": "#25c7e2",
            "stroke-width": "2",
            "stroke-linecap": "butt",
            "fill": "none"
        };

        const curveA = SVG.createElement("path", attrDark);
        const curveB = SVG.createElement("path", attrBright);
        const curveC = SVG.createElement("path", attrDark);
        this.pointer = SVG.createElement("line", attrPointer);
        this.builderA = SVGPathBuilder.get(curveA);
        this.builderB = SVGPathBuilder.get(curveB);
        this.builderC = SVGPathBuilder.get(curveC);
        this.svg.appendChild(curveA);
        this.svg.appendChild(curveB);
        this.svg.appendChild(curveC);
        this.svg.appendChild(this.pointer);

        attachEvents(this.svg, this.background, this.parameter);
        this.update();
    }

    update() {
        const parameter = this.parameter;
        const angleMin = ParameterKnob.PI_HALF + ParameterKnob.ANGLE_OFFSET;
        const angleVal = angleMin + parameter.unipolar * ParameterKnob.ANGLE_RANGE;
        const angleAnc = angleMin + parameter.anchor * ParameterKnob.ANGLE_RANGE;
        const angleMax = ParameterKnob.PI_HALF - ParameterKnob.ANGLE_OFFSET;
        const aMinValAnc = Math.min(angleVal, angleAnc);
        const aMaxValAnc = Math.max(angleVal, angleAnc);
        this.builderA.circleSegment(ParameterKnob.CIRCLE_X, ParameterKnob.CIRCLE_Y, ParameterKnob.CIRCLE_RADIUS, angleMin, aMinValAnc).complete();
        this.builderB.circleSegment(ParameterKnob.CIRCLE_X, ParameterKnob.CIRCLE_Y, ParameterKnob.CIRCLE_RADIUS, aMinValAnc, aMaxValAnc).complete();
        this.builderC.circleSegment(ParameterKnob.CIRCLE_X, ParameterKnob.CIRCLE_Y, ParameterKnob.CIRCLE_RADIUS, aMaxValAnc, angleMax).complete();
        this.pointer.setAttribute("x1", ParameterKnob.CIRCLE_X);
        this.pointer.setAttribute("y1", ParameterKnob.CIRCLE_Y);
        this.pointer.setAttribute("x2", ParameterKnob.CIRCLE_X + Math.cos(angleVal) * ParameterKnob.CIRCLE_RADIUS);
        this.pointer.setAttribute("y2", ParameterKnob.CIRCLE_Y + Math.sin(angleVal) * ParameterKnob.CIRCLE_RADIUS);
        this.print.textContent = parameter.print() + " " + parameter.unit;
    }

    get domElement() {
        return this.svg;
    }
}

ParameterKnob.PI_HALF = Math.PI * 0.5;
ParameterKnob.ANGLE_OFFSET = Math.PI / 6.0;
ParameterKnob.ANGLE_RANGE = (Math.PI * 2.0 - ParameterKnob.ANGLE_OFFSET * 2.0);
ParameterKnob.WIDTH = 72;
ParameterKnob.HEIGHT = 80;
ParameterKnob.CIRCLE_X = ParameterKnob.WIDTH / 2;
ParameterKnob.CIRCLE_Y = 40;
ParameterKnob.CIRCLE_RADIUS = 15;
ParameterKnob.FONT_STYLE = {
    "font-family": "Open sans",
    "font-size": "10",
    "alignment-baseline": "middle",
    "text-anchor": "middle",
    "fill": "#28E5FF"
};

export class ParameterField {
    constructor(parameter) {
        this.parameter = parameter;
        this.parameter.addCallback(ignore => this.update());
        this.svg = SVG.create(ParameterField.WIDTH, ParameterField.HEIGHT);
        this.svg.style.margin = "2px";
        this.background = createBackground(ParameterField.WIDTH, ParameterField.HEIGHT);
        this.background.style.visibility = "hidden";
        this.name = SVG.text(ParameterField.CENTER_X, 10, parameter.name, ParameterField.FONT_STYLE);
        this.print = SVG.text(ParameterField.CENTER_X, ParameterField.HEIGHT - 10, "708 Hz", ParameterField.FONT_STYLE);
        this.svg.appendChild(this.background);
        this.svg.appendChild(this.name);
        this.svg.appendChild(this.print);

        this.update();
        attachEvents(this.svg, this.background, this.parameter);
    }

    update() {
        this.print.textContent = this.parameter.print() + " " + this.parameter.unit;
    }

    get domElement() {
        return this.svg;
    }
}

ParameterField.WIDTH = 72;
ParameterField.HEIGHT = 34;
ParameterField.CENTER_X = ParameterField.WIDTH / 2;
ParameterField.FONT_STYLE = {
    "font-family": "Open sans",
    "font-size": "10",
    "alignment-baseline": "middle",
    "text-anchor": "middle",
    "fill": "#28E5FF"
};

export class AdsrEnvelopeEditor {
    constructor(format, width, options) {
        this.format = format;
        this.root = document.createElement("div");
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.gridColumn = "1/5";
        this.context = this.canvas.getContext("2d");
        this.curve = new ExpCurveAlgorithm();

        this.root.style.width = width + "px";
        this.root.style.display = "grid";
        this.root.style.gridTemplateColumns = "1fr 1fr 1fr 1fr";
        this.root.style.gridTemplateRows = "56px 1fr";
        this.root.appendChild(this.canvas);
        this.root.appendChild(new ParameterKnob(format.attackTime).domElement);

        const boxes = document.createElement("div");
        boxes.style.display = "flex";
        boxes.style.flexDirection = "column";
        boxes.style.justifyContent = "center";

        if (options && options.releaseEnabledChangeable) {
            this.createCheckbox(boxes, value => format.releaseEnabled.value = value, format.releaseEnabled.value, "Release");
        }
        this.createCheckbox(boxes, value => format.decayLoop.value = value, format.decayLoop.value, "Loop");

        this.root.appendChild(boxes);
        this.root.appendChild(new ParameterKnob(format.decayTime).domElement);
        this.root.appendChild(new ParameterKnob(format.releaseTime).domElement);
        this.width = this.root.clientWidth;
        this.height = this.root.clientHeight;
        this.devicePixelRatio = window.devicePixelRatio;
        const update = () => {
            if (
                this.width !== this.root.clientWidth ||
                this.height !== this.root.clientHeight ||
                this.devicePixelRatio !== window.devicePixelRatio) {
                this.width = this.root.clientWidth;
                this.height = this.root.clientHeight;
                this.devicePixelRatio = window.devicePixelRatio;
                this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
                this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
                this.update();
            }
            window.requestAnimationFrame(update);
        };
        window.requestAnimationFrame(update);
        format.attackBend.addCallback(ignore => this.update());
        format.decayBend.addCallback(ignore => this.update());
        format.sustainValue.addCallback(ignore => this.update());
        format.releaseBend.addCallback(ignore => this.update());
        this.attachEvents();
    }

    createCheckbox(parent, onchange, value, labelText) {
        const container = document.createElement("div");
        const checkbox = document.createElement("input");
        checkbox.setAttribute("type", "checkbox");
        checkbox.onchange = ignore => onchange(checkbox.checked);
        checkbox.checked = value;
        const id = uid();
        checkbox.id = id;
        const label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = labelText;
        container.appendChild(checkbox);
        container.appendChild(label);
        parent.appendChild(container);
        return checkbox;
    }

    update() {
        const canvas = this.canvas;
        const context = this.context;
        const format = this.format;
        const curve = this.curve;
        const w4 = canvas.width / 4;
        let value, delta, multiplier, x;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.translate(0.0, 0.5);
        context.lineWidth = this.devicePixelRatio;
        // 28E5FF
        context.strokeStyle = "rgb(40, 229, 255)";
        context.fillStyle = "rgba(40, 229, 255, 0.5)";
        context.beginPath();
        curve.byBend(w4, 0.0, format.attackBend.value, 1.0);
        context.moveTo(0, this.valueToY(0.0));
        delta = curve.delta;
        multiplier = curve.multiplier;
        value = 0.0;
        for (x = 1; x < w4; ++x) {
            context.lineTo(x, this.valueToY(value = value * multiplier + delta));
        }
        curve.byBend(w4, 1.0, format.decayBend.value, format.sustainValue.value);
        context.lineTo(w4, this.valueToY(1.0));
        delta = curve.delta;
        multiplier = curve.multiplier;
        value = 1.0;
        for (x = 1; x < w4; ++x) {
            context.lineTo(w4 + x, this.valueToY(value = value * multiplier + delta));
        }
        const sustainY = Math.round(this.valueToY(format.sustainValue.value));
        context.lineTo(w4 * 2, sustainY);
        context.lineTo(w4 * 3, sustainY);
        curve.byBend(w4, format.sustainValue.value, format.releaseBend.value, 0.0);
        delta = curve.delta;
        multiplier = curve.multiplier;
        value = format.sustainValue.value;
        for (x = 1; x < w4; ++x) {
            context.lineTo(w4 * 3 + x, this.valueToY(value = value * multiplier + delta));
        }
        context.fill();
        context.stroke();
        context.restore();
    }

    valueToY(value) {
        const range = this.canvas.height - 1.0;
        return range - value * range;
    }

    get domElement() {
        return this.root;
    }

    attachEvents() {
        const canvas = this.canvas;
        const format = this.format;
        let target = -1;
        let value = 0;
        let position = 0;
        const onMouseMove = event => {
            const rect = canvas.getBoundingClientRect();
            const delta = (position - (event.clientY - rect.y)) * 0.01;
            switch (target) {
                case 0:
                    format.attackBend.unipolar = clamp(0.0, 1.0, value + delta);
                    break;
                case 1:
                    format.decayBend.unipolar = clamp(0.0, 1.0, value + delta);
                    break;
                case 2:
                    format.sustainValue.unipolar = clamp(0.0, 1.0, value + delta);
                    break;
                case 3:
                    format.releaseBend.unipolar = clamp(0.0, 1.0, value + delta);
                    break;
            }
        };
        const onMouseUp = ignore => {
            target = -1;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        const onMouseDown = event => {
            const rect = canvas.getBoundingClientRect();
            target = Math.floor((event.clientX - rect.x) / canvas.clientWidth * 4);
            position = event.clientY - rect.y;
            switch (target) {
                case 0:
                    value = format.attackBend.unipolar;
                    break;
                case 1:
                    value = format.decayBend.unipolar;
                    break;
                case 2:
                    value = format.sustainValue.unipolar;
                    break;
                case 3:
                    value = format.releaseBend.unipolar;
                    break;
            }
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        };
        this.canvas.addEventListener("mousedown", onMouseDown);
    }
}

export class EuclideanSteps {
    constructor(model) {
        this.model = model;
        this.root = document.createElement("div");
        this.root.style.width = "144px";
        this.root.style.height = "164px";
        this.root.style.position = "relative";
        this.svg = SVG.create(144, 144);
        this.svg.style.bottom = "0";
        this.svg.style.position = "absolute";
        this.header = document.createElement("div");
        this.header.style.fontSize = "10px";
        this.header.style.textAlign = "center";
        this.header.style.height = "20px";
        this.root.appendChild(this.header);
        this.root.appendChild(this.svg);
        this.root.appendChild(setAbsoluteXY(new ParameterField(model.parameterPulses).domElement, 34, 36));
        this.root.appendChild(setAbsoluteXY(new ParameterField(model.parameterShift).domElement, 34, 72));
        this.root.appendChild(setAbsoluteXY(new ParameterField(model.parameterSteps).domElement, 34, 108));
        this.update();

        model.parameterSteps.addCallback(ignore => this.update());
        model.parameterPulses.addCallback(ignore => this.update());
        model.parameterShift.addCallback(ignore => this.update());

        this.index = -1;
    }

    random() {
        const steps = 1.0 - Math.random() * Math.random() * Math.random();
        this.model.parameterSteps.unipolar = steps;
        this.model.parameterPulses.unipolar = Math.random() * Math.random() * Math.random() * steps;
        this.model.parameterPulses.value = Math.max(this.model.parameterPulses.value, 1);
        this.model.parameterShift.unipolar = Math.random() * Math.random();
    }

    highlight(index) {
        this.index = index;
        this.update();
    }

    set name(value) {
        this.header.textContent = value;
    }

    update() {
        emptyElement(this.svg);

        const size = 144;
        const halfSize = size / 2;
        const radius = 5;
        const offset = halfSize - radius;
        this.svg.appendChild(SVG.circle(halfSize, halfSize, offset, {
            "fill": "transparent",
            "stroke": "#000",
            "stroke-width": radius * 2
        }));
        const steps = this.model.steps;
        const angleStepSize = Math.PI * 2.0 / steps;
        for (let i = 0; i < steps; i++) {
            const angle = i * angleStepSize;
            const x = 72 + Math.sin(angle) * offset;
            const y = 72 - Math.cos(angle) * offset;
            this.svg.appendChild(this.createCircle(x, y, i, radius, this.model.getStepAt(i)));
        }
    }

    createCircle(x, y, index, radius, active) {
        if (index === this.index % this.model.steps) {
            return SVG.circle(x, y, radius, active ? EuclideanSteps.ACTIVE_ON : EuclideanSteps.IN_ACTIVE_ON);
        } else {
            return SVG.circle(x, y, radius, active ? EuclideanSteps.ACTIVE_OFF : EuclideanSteps.IN_ACTIVE_OFF);
        }
    }

    get domElement() {
        return this.root;
    }
}

EuclideanSteps.IN_ACTIVE_OFF = {"fill": "#404040"};
EuclideanSteps.IN_ACTIVE_ON = {"fill": "#505050"};
EuclideanSteps.ACTIVE_OFF = {"fill": "#28E5FF"};
EuclideanSteps.ACTIVE_ON = {"fill": "#FFFFFF"};