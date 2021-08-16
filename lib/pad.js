importScripts("../lib/fft.js");

class Harmonic {
    constructor() {
        this.position = 1.0;
        this.level = 0.0;
        this.bandWidth = 0.0;
    }
}

class Pad {
    constructor(fftSize, sampleRate, frequencies) {
        this.fftSize = fftSize;
        this.fftBins = fftSize >> 1;
        this.sampleRate = sampleRate;
        this.frequencies = frequencies;
        this.bin = this.sampleRate / this.fftSize;
        this.numTables = frequencies.length;
        this.freqInverse = new Float32Array(this.numTables);
        this.sin = new Float32Array(this.fftBins);
        this.cos = new Float32Array(this.fftBins);
        this.falloff = new Float32Array(this.fftBins);
        this.profiles = new Float32Array(this.fftBins);
        this.real = new Float32Array(this.fftSize);
        this.imag = new Float32Array(this.fftSize);
        this.fft = new FFT(this.fftSize);
        this.tables = new Array(this.numTables);

        const random = new Random(0x91826);
        const cutIndex = Math.floor(Pad.FALLOFF_HZ / this.bin);
        const a = Math.PI / (cutIndex * 2.0);
        for (let i = 0; i < this.fftBins; i++) {
            if (i > cutIndex) {
                const x = Math.cos((i - cutIndex) * a);
                this.falloff[i] = x * x;
            } else {
                this.falloff[i] = 1.0;
            }
            const phase = random.nextFloat() * 2.0 * Math.PI;
            this.sin[i] = Math.sin(phase);
            this.cos[i] = Math.cos(phase);
        }
        console.log("Prepare static arrays...");
        for (let index = 0; index < this.numTables; index++) {
            const frequency = this.frequencies[index];
            this.tables[index] = new Float32Array(this.fftSize);
            this.freqInverse[index] = this.sampleRate / frequency;
        }
    }

    update(harmonics) {
        for (let i = 0; i < this.numTables; i++) {
            this.updateTable(harmonics, this.tables[i], this.frequencies[i]);
        }
        return this.tables;
    }

    updateTable(harmonics, table, frequency) {
        const normalisedFrequency = frequency / this.sampleRate;
        const fftBins = this.fftBins;
        const fftSize = this.fftSize;
        const fftSizeInverse = 1.0 / fftSize;
        for (let i = 0; i < harmonics.length; i++) {
            const harmonic = harmonics[i];
            if (!harmonic.active) {
                continue;
            }
            const fh = harmonic.position * normalisedFrequency;
            const bwi = harmonic.bandWidth * normalisedFrequency * 0.5;
            const temp = bwi * Pad.BOUND;
            const jMin = Math.max(1, -Math.floor((temp - fh) * fftSize)) | 0;
            if (jMin >= fftBins) {
                continue;
            }
            const lh = harmonic.level;
            const jMid = Math.min(fftBins, Math.floor(fh * fftSize)) | 0;
            const jMax = Math.min(fftBins, Math.ceil((temp + fh) * fftSize)) | 0;
            let j = jMin;
            for (; j < jMid; j++) { // left half of the bell curve
                this.profiles[j] += Pad.profile(j * fftSizeInverse - fh, bwi) * lh;
            }
            if (jMid < jMax) {
                this.profiles[jMid] += Pad.profile(0.0, bwi) * lh; // peak of the bell curve
                for (; j < jMax; j++) { // right half of the bell curve
                    this.profiles[j] += Pad.profile(j * fftSizeInverse - fh, bwi) * lh;
                }
            }
        }
        for (let i = 0; i < fftBins; i++) {
            const profile = this.profiles[i] * this.falloff[i];
            this.real[i] = profile * this.sin[i];
            this.imag[i] = profile * this.cos[i];
            this.profiles[i] = 0.0;
        }
        this.fft.process(this.imag, this.real);
        let max = 0.0;
        for (let i = 0; i < fftSize; i++) {
            const amplitude = this.real[i];
            if (max < Math.abs(amplitude)) {
                max = Math.abs(amplitude);
            }
            table[i] = amplitude;
            this.real[i] = 0.0;
            this.imag[i] = 0.0;
        }
        const scale = 1.0 / (max * Math.sqrt(2.0));
        for (let j = 0; j < fftSize; j++) {
            table[j] *= scale;
        }
    }

    static profile(fi, bwi) {
        let x = fi / bwi;
        x *= x;
        return x > Pad.MIN_EXP ? 0.0 : Math.exp(-x) / bwi;
    }
}

Pad.FALLOFF_HZ = 18000.0;
Pad.MIN_EXP = 14.71280603; // This value is the bound at which the values get too small
Pad.BOUND = Math.sqrt(Pad.MIN_EXP);

class Random {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        return this.seed = this.seed * 16807 % 2147483647;
    };

    nextFloat() {
        return (this.next() - 1.0) / 2147483646;
    };
}