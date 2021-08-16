import {Random} from "../modules/neutrons.js";

export const Color = {
    Brownian: frequency => 1.0 / frequency,
    Pink: frequency => 1.0 / Math.sqrt(frequency),
    White: frequency => 1.0,
    Blue: frequency => Math.sqrt(frequency),
    Violet: frequency => frequency
};

export const noiseGen = (seed, color) => {
    const random = new Random(seed);
    const fftWorker = new Worker("./workers/fft.js");
    const Q = 18;
    const fftSize = 1 << Q;
    const fftBins = fftSize >> 1;
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    return new Promise((resolve, ignore) => {
        fftWorker.postMessage(fftSize);
        fftWorker.onmessage = event => {
            const samples = new Float32Array(event.data[0]);
            let max = 0.0;
            for (let i = 0; i < fftSize; i++) {
                max = Math.max(Math.abs(samples[i]), max);
            }
            const scale = 1.0 / (max * Math.sqrt(2.0));
            for (let i = 0; i < fftSize; i++) {
                samples[i] *= scale;
            }
            resolve(samples);
        };
        for (let i = 1; i < fftBins; i++) {
            const p = random.nextFloat() * Math.PI * 2.0;
            const a = color(i / fftSize);
            real[i] = a * Math.sin(p);
            imag[i] = a * Math.cos(p);
        }
        fftWorker.postMessage([imag.buffer, real.buffer]);
    });
};