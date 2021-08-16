import {RenderQuantum} from "../modules/neutrons.js";

registerProcessor("block", class extends AudioWorkletProcessor {
    constructor() {
        super();

        this.n = 0;
        this.i = 0;
        this.block = null;
        this.port.onmessage = event => {
            this.i = 0;
            this.n = event.data;
            this.block = new Float32Array(this.n);
        };
    }

    process(inputs) {
        if (0 === this.n) {
            return true;
        }
        const input = inputs[0][0];
        for (let i = 0; i < RenderQuantum; i++) {
            this.block[this.i++] = input[i];
        }
        if (this.i === this.block.length) {
            this.i = 0;
            this.port.postMessage(this.block);
        }
        return true;
    }
});