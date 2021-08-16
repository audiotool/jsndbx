import {RenderQuantum} from "../modules/neutrons.js";

registerProcessor("mapper", class extends AudioWorkletProcessor {
    constructor() {
        super();

        this.func = null;
        this.port.onmessage = event => {
            this.func = eval(event.data);
        };
    }

    process(inputs, outputs) {
        const input = inputs[0][0];
        const output = outputs[0][0];
        if (null === this.func) {
            for (let i = 0; i < RenderQuantum; i++) {
                output[i] = input[i];
            }
        } else {
            for (let i = 0; i < RenderQuantum; i++) {
                output[i] = this.func(input[i]);
            }
        }
        return true;
    }
});