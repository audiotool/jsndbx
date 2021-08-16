import {RenderQuantum} from "../modules/neutrons.js";

registerProcessor("envelope-follower", class extends AudioWorkletProcessor {
    constructor() {
        super();

        this.attackCoeff = NaN;
        this.releaseCoeff = NaN;
        this.envelope = 0.0;

        this.port.onmessage = event => {
            const data = event.data;
            switch (data.action) {
                case "attack": {
                    this.attackCoeff = Math.exp(-1.0 / (sampleRate * data.value));
                    break;
                }
                case "release": {
                    this.releaseCoeff = Math.exp(-1.0 / (sampleRate * data.value));
                    break;
                }
            }
        };
    }

    process(inputs, outputs) {
        const input = inputs[0];
        const output = outputs[0][0];
        for (let i = 0; i < RenderQuantum; i++) {
            let peak = 0.0;
            for (let ch = 0; ch < input.length; ch++) {
                peak = Math.max(Math.abs(input[ch][i]), peak);
            }
            if (this.envelope < peak) {
                this.envelope = peak + this.attackCoeff * (this.envelope - peak);
            } else {
                this.envelope = peak + this.releaseCoeff * (this.envelope - peak);
            }
            output[i] = this.envelope;
        }
        return true;
    }
});