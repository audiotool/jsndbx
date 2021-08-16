import {deserialiseMapping} from "../modules/mapping.js";
import {RenderQuantum, ExpCurveAlgorithm} from "../modules/neutrons.js";

registerProcessor("ExpCurve", class extends AudioWorkletProcessor {
    constructor() {
        super();

        this.values = null;
        this.position = 0 | 0;
        this.index = 0;
        this.delta = 0.0;
        this.multiplier = 1.0;
        this.value = 0.0;
        this.nextPhase = Number.MAX_SAFE_INTEGER;
        this.curve = new ExpCurveAlgorithm();
        this.mapping = null;

        this.port.onmessage = event => {
            const data = event.data;
            const action = data.action;
            switch (action) {
                case "set-points": {
                    this.values = data.value;
                    this.reset();
                    break;
                }
                case "set-mapping": {
                    this.mapping = deserialiseMapping(data.value);
                    break;
                }
                case "reset": {
                    this.reset();
                    break;
                }
            }
        };
    }

    reset() {
        this.position = 0 | 0;
        this.index = 0 | 0;
        this.advancePhase();
    }

    advancePhase() {
        if (this.values === null || this.values.length === 0) {
            throw new Error("No data points set.");
        }
        const maxIndex = (this.values.length - 1) | 0;
        if (this.index >= maxIndex) {
            this.delta = 0.0;
            this.multiplier = 1.0;
            this.value = this.x(this.values[maxIndex].value);
            this.nextPhase = Number.MAX_SAFE_INTEGER;
        } else {
            const curve = this.curve;
            const v0 = this.values[this.index++];
            const v1 = this.values[this.index];
            curve.byBend((v1.time - v0.time) * sampleRate, this.x(v0.value), v0.slope, this.x(v1.value));
            this.delta = curve.delta;
            this.multiplier = curve.multiplier;
            this.value = this.x(v0.value);
            this.nextPhase = (v1.time * sampleRate) | 0;
        }
    }

    x(value) {
        return null === this.mapping ? value : this.mapping.x(value);
    }

    y(value) {
        return null === this.mapping ? value : this.mapping.y(value);
    }

    process(inputs, outputs) {
        if (this.values === null || this.values.length === 0) {
            throw new Error("No data points set.");
        }
        const output = outputs[0][0];
        let index = 0;
        while (index < RenderQuantum) {
            const process = Math.min(RenderQuantum, this.nextPhase - this.position);
            for (let i = 0; i < process; i++) {
                output[index++] = this.y(this.value);
                this.value = this.value * this.multiplier + this.delta;
            }
            this.position += process;
            if (this.position === this.nextPhase) {
                this.advancePhase();
            }
        }
        return true;
    }
});