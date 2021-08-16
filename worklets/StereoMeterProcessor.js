import * as N from '../modules/neutrons.js';

registerProcessor("StereoMeterProcessor", class extends AudioWorkletProcessor {
    constructor(options) {
        super(options);

        const fps = 60.0;
        const rmsSize = sampleRate * 0.050; // 50ms
        this.updateRate = (sampleRate / fps) | 0;
        this.updateCount = 0 | 0;
        this.maxPeaks = new Float32Array(2);
        this.maxSquares = new Float32Array(2);
        this.rmsChannels = [new N.RMS(rmsSize), new N.RMS(rmsSize)];
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        for (let channel = 0; channel < output.length; ++channel) {
            const inputChannel = input[channel];
            const outputChannel = output[channel];
            const rms = this.rmsChannels[channel];
            let maxPeak = this.maxPeaks[channel];
            let maxSquare = this.maxSquares[channel];
            if (undefined === inputChannel) {
                this.maxPeaks[channel] = 0.0;
                this.maxSquares[channel] = 0.0;
            } else {
                for (let i = 0; i < inputChannel.length; ++i) {
                    const inp = outputChannel[i] = inputChannel[i]; // we pass the signal
                    maxPeak = Math.max(maxPeak, Math.abs(inp));
                    maxSquare = Math.max(maxSquare, rms.pushPop(inp * inp));
                }
                this.maxPeaks[channel] = maxPeak;
                this.maxSquares[channel] = maxSquare;
            }
        }
        this.updateCount += N.RenderQuantum;
        if (this.updateCount >= this.updateRate) {
            this.updateCount -= this.updateRate;
            this.port.postMessage([this.maxSquares, this.maxPeaks]);
            for (let channel = 0; channel < 2; ++channel) {
                this.maxPeaks[channel] = 0.0;
                this.maxSquares[channel] = 0.0;
            }
        }
        return true;
    }
});