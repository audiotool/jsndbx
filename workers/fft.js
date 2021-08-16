importScripts("../lib/fft.js");

let fft = null;

onmessage = event => {
    const data = event.data;
    if (typeof(data) === 'number') {
        fft = new FFT(data);
    }
    else if (typeof(data) === 'object') {
        if (null === fft) {
            throw new Error("FFT size not set");
        }
        const now = performance.now();
        const real = new Float32Array(data[0]);
        const imag = new Float32Array(data[1]);
        fft.process(real, imag);
        console.log("fft processed in " + (performance.now() - now) + "ms");
        self.postMessage([real.buffer, imag.buffer], [real.buffer, imag.buffer]);
    }
};