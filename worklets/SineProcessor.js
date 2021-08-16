import {RenderQuantum} from "../modules/neutrons.js";

registerProcessor("sine", class extends AudioWorkletProcessor {
    constructor(options) {
        super(options);

        this.phase = 0.0;
        this.frequency = 0.0;

        this.port.onmessage = event => this.frequency = event.data;
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];
        for (let i = 0; i < RenderQuantum; i++) {
            channel[i] = Math.sin(this.phase * 2.0 * Math.PI);
            this.phase += this.frequency / sampleRate;
        }
        return true;
    }
});