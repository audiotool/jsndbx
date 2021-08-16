import {dbToGain, gainToDb, RenderQuantum} from "../modules/neutrons.js";

registerProcessor("limiter", class extends AudioWorkletProcessor {
    constructor() {
        super();

        this.lookAheadFrames = 0 | 0;
        this.buffer = null;
        this.position = 0 | 0;
        this.remaining = 0 | 0;
        this.slope = 0.0;
        this.envelope = 0.0;
        this.threshold = -1.0;

        this.port.onmessage = event => {
            const data = event.data;
            if (data.action === "lookahead") {
                this.config(data.value);
            } else if (data.action === "threshold") {
                this.threshold = data.value;
            }
        };
    }

    config(lookAheadSeconds) {
        this.lookAheadFrames = Math.ceil(lookAheadSeconds * sampleRate) | 0;
        this.buffer = [
            new Float32Array(this.lookAheadFrames),
            new Float32Array(this.lookAheadFrames)
        ];
        this.position = 0 | 0;
        this.remaining = 0 | 0;
        this.slope = 0.0;
        this.envelope = 0.0;

        this.releaseTime = 0.1;
        this.releaseCoeff = Math.exp(-1.0 / (sampleRate * this.releaseTime));
        this.envelope = 0.0;
    }

    process(inputs, outputs) {
        const buffer = this.buffer;
        if (null === buffer) {
            return true;
        }
        // This number is found by trying to make the limiter super brick-wall.
        // There is probably a way to calculate it. Only tested for 5ms look-ahead.
        const MAGIC_HEADROOM = -0.41; // -0.40 already does not work with some input
        const frames = this.lookAheadFrames;
        const input = inputs[0];
        const output = outputs[0];
        const input0 = input[0];
        const input1 = input[1];
        const output0 = output[0];
        const output1 = output[1];
        const buffer0 = buffer[0];
        const buffer1 = buffer[1];
        for (let i = 0; i < RenderQuantum; i++) {
            const inp0 = input0[i];
            const inp1 = input1[i];
            const peak = Math.max(Math.abs(inp0), Math.abs(inp1));
            if (this.envelope < peak) {
                this.envelope = peak;
            } else {
                this.envelope = peak + this.releaseCoeff * (this.envelope - peak);
            }
            const gain = dbToGain(Math.min(0.0, this.threshold - gainToDb(this.envelope)))
                * dbToGain(MAGIC_HEADROOM - this.threshold);
            output0[i] = buffer0[this.position] * gain;
            output1[i] = buffer1[this.position] * gain;
            buffer0[this.position] = inp0;
            buffer1[this.position] = inp1;
            this.position = (this.position + 1) % frames;
        }
        return true;
    }
});