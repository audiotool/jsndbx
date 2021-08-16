import {Linear, Percent} from "./mapping.js";

export class Parameter {
    constructor(name, unit, valueMapping, printMapping, value, anchor) {
        this.name = name;
        this.unit = unit;
        this.anchor = anchor;
        this.valueMapping = valueMapping;
        this.printMapping = printMapping;

        this._value = value;
        this._default = value;
        this._callbacks = [];
    }

    reset() {
        this.value = this._default;
    }

    set value(value) {
        if (this._value === value) {
            return;
        }
        this._value = value;
        this.notify();
    }

    get value() {
        return this._value;
    }

    set unipolar(value) {
        this.value = this.valueMapping.y(value);
    }

    get unipolar() {
        return this.valueMapping.x(this._value);
    }

    print() {
        return this.printMapping.output(this.valueMapping, this.unipolar);
    }

    parse(text) {
        const newValue = this.printMapping.input(this.valueMapping, text);
        if (!isNaN(newValue)) {
            this.value = newValue;
        }
    }

    addCallback(callback) {
        this._callbacks.push(callback);
    }

    notify() {
        for (let callback of this._callbacks) {
            callback(this);
        }
    }
}

export class SharedParameter extends Parameter {
    constructor(port, id, name, unit, valueMapping, printMapping, value, anchor) {
        super(name, unit, valueMapping, printMapping, value, anchor);

        this.id = id;
        this.port = port;
        this.share();
    }

    notify() {
        this.share();
        super.notify();
    }

    share() {
        this.port.postMessage({action: "updateParameter", value: {id: this.id, value: this._value}});
    }
}

export class ParameterBuilder {
    static begin(name) {
        return new ParameterBuilder(name);
    }

    constructor(name) {
        this.$name = name;
        this.$unit = "%";
        this.$valueMapping = Linear.Identity;
        this.$printMapping = Percent;
        this.$value = 0.5;
        this.$anchor = 0.0;
        this.$callback = null;
    }

    name(value) {
        this.$name = value;
        return this;
    }

    unit(value) {
        this.$unit = value;
        return this;
    }

    valueMapping(value) {
        this.$valueMapping = value;
        return this;
    }

    printMapping(value) {
        this.$printMapping = value;
        return this;
    }

    value(value) {
        this.$value = value;
        return this;
    }

    anchor(value) {
        this.$anchor = value;
        return this;
    }

    callback(func) {
        this.$callback = func;
        return this;
    }

    create() {
        const parameter = new Parameter(this.$name, this.$unit, this.$valueMapping, this.$printMapping, this.$value, this.$anchor);
        if (null !== this.$callback) {
            parameter.addCallback(this.$callback);
        }
        return parameter;
    }

    createShared(port, id) {
        const parameter = new SharedParameter(port, id, this.$name, this.$unit, this.$valueMapping, this.$printMapping, this.$value, this.$anchor);
        if (null !== this.$callback) {
            parameter.addCallback(this.$callback);
        }
        return parameter;
    }
}