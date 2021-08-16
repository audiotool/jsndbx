export const PI_2 = Math.PI * 2.0;
export const PI_HALF = Math.PI / 2.0;
export const log2 = Math.log(2);
export const sqrt2 = Math.sqrt(2);
export const sqrt2Inv = 1.0 / Math.sqrt(2);
export const LogDb = Math.log(10.0) / 20.0;
export const RenderQuantum = 128;

export const midiToFrequency = (note, baseFrequency) => baseFrequency * Math.pow(2.0, (note + 3.0) / 12.0 - 6.0);
export const dbToGain = db => Math.exp(db * LogDb);
export const gainToDb = gain => Math.log(gain) / LogDb;
export const biToUnipolar = x => (x + 1.0) * 0.5;
export const envCoeff = (ms, sampleRate) => Math.exp(-1.0 / (ms / 1000.0 * sampleRate));
export const sqnr = bits => -20.0 * Math.log10(1 << bits); // Signal to quantization noise ratio
export const numFramesToBars = (numFrames, bpm, samplingRate) => (numFrames * bpm) / (samplingRate * 240.0);
export const barsToNumFrames = (bars, bpm, samplingRate) => (bars * samplingRate * 240.0) / bpm;
export const barsToSeconds = (bars, bpm) => (bars * 240.0) / bpm;
export const tri = (x, q) => 1.0 - 2.0 * Math.acos((1.0 - q) * Math.sin(2.0 * Math.PI * x)) / Math.PI; // q = 0.01
export const negMod = (x, y) => {
    const r = x % y;
    return r < 0.0 ? r + y : r;
};
// https://www.w3.org/TR/webaudio/#dom-audioparam-exponentialramptovalueattime
export const exponentialRampByTime = (v0, v1, t0, t1, t) => {
    return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
};
// solve(v=v0*(v1 / v0)^((t-t0)/(t1-t0)), t);
export const exponentialRampByValue = (v0, v1, t0, t1, v) => {
    const logv1dv0 = Math.log(v1 / v0);
    return (t0 * logv1dv0 + (t1 - t0) * Math.log(v / v0)) / logv1dv0;
};
export const hermite = (x, phase, mask) => {
    const idx = phase | 0;
    const alpha = phase - idx;
    const xm1 = x[(idx) & mask];
    const x0 = x[(idx + 1) & mask];
    const x1 = x[(idx + 2) & mask];
    const x2 = x[(idx + 3) & mask];
    const a = (3.0 * (x0 - x1) - xm1 + x2) * 0.5;
    const b = 2.0 * x1 + xm1 - (5.0 * x0 + x2) * 0.5;
    const c = (x1 - xm1) * 0.5;
    return (((a * alpha) + b) * alpha + c) * alpha + x0;
};
export const hermiteNonPow2 = (x, phase, n) => {
    const idx = phase | 0;
    const alpha = phase - idx;
    const xm1 = x[negMod(idx, n)];
    const x0 = x[negMod(idx + 1, n)];
    const x1 = x[negMod(idx + 2, n)];
    const x2 = x[negMod(idx + 3, n)];
    const a = (3.0 * (x0 - x1) - xm1 + x2) * 0.5;
    const b = 2.0 * x1 + xm1 - (5.0 * x0 + x2) * 0.5;
    const c = (x1 - xm1) * 0.5;
    return (((a * alpha) + b) * alpha + c) * alpha + x0;
};
export const hermiteNonPow2NonCircle = (x, phase, n) => {
    let idx = phase | 0;
    const alpha = phase - idx;
    const xm1 = x[idx];
    const x0 = ++idx >= n ? 0.0 : x[idx];
    const x1 = ++idx >= n ? 0.0 : x[idx];
    const x2 = ++idx >= n ? 0.0 : x[idx];
    const a = (3.0 * (x0 - x1) - xm1 + x2) * 0.5;
    const b = 2.0 * x1 + xm1 - (5.0 * x0 + x2) * 0.5;
    const c = (x1 - xm1) * 0.5;
    return (((a * alpha) + b) * alpha + c) * alpha + x0;
};
export const linkwitzRileyLowHiCoeffs = (fc, sf) => {
    const wc = 2 * Math.PI * fc;
    const wc2 = wc * wc;
    const wc3 = wc2 * wc;
    const wc4 = wc2 * wc2;
    const k = wc / Math.tan(Math.PI * fc / sf);
    const k2 = k * k;
    const k3 = k2 * k;
    const k4 = k2 * k2;
    const sq_tmp1 = sqrt2 * wc3 * k;
    const sq_tmp2 = sqrt2 * wc * k3;
    const a_tmp = 4 * wc2 * k2 + 2 * sq_tmp1 + k4 + 2 * sq_tmp2 + wc4;
    const feedback = [
        1.0,
        ((4 * (wc4 + sq_tmp1 - k4 - sq_tmp2)) / a_tmp),
        ((6 * wc4 - 8 * wc2 * k2 + 6 * k4) / a_tmp),
        ((4 * (wc4 - sq_tmp1 + sq_tmp2 - k4)) / a_tmp),
        ((k4 - 2 * sq_tmp1 + wc4 - 2 * sq_tmp2 + 4 * wc2 * k2) / a_tmp)];
    return [
        [
            [(wc4 / a_tmp), (4 * wc4 / a_tmp), (6 * wc4 / a_tmp), (4 * wc4 / a_tmp), (wc4 / a_tmp)], feedback
        ],
        [
            [(k4 / a_tmp), (-4 * k4 / a_tmp), (6 * k4 / a_tmp), (-4 * k4 / a_tmp), (k4 / a_tmp)], feedback
        ]
    ];
};
export const crossoverIIRFilters = (context, source, frequencies, sampleRate) => {
    const bands = [];
    for (let i = 0; i < frequencies.length; ++i) {
        const frequency = frequencies[i];
        const coefficients = linkwitzRileyLowHiCoeffs(frequency, sampleRate);
        const lp = context.createIIRFilter(coefficients[0][0], coefficients[0][1]);
        const hp = context.createIIRFilter(coefficients[1][0], coefficients[1][1]);
        source.connect(lp);
        source.connect(hp);
        for (let j = 0; j < bands.length; ++j) { // apply ap to all frequencies in array
            const band = bands[j];
            const lpa = context.createIIRFilter(coefficients[0][0], coefficients[0][1]);
            const hpa = context.createIIRFilter(coefficients[1][0], coefficients[1][1]);
            const ap = context.createGain();
            band.connect(lpa).connect(ap);
            band.connect(hpa).connect(ap);
            bands[j] = ap;
        }
        bands.push(lp);
        source = hp;
    }
    bands.push(source);
    return bands;
};
export const downmix = buffer => {
    const mono = new Float32Array(buffer.length);
    for (let j = 0; j < buffer.numberOfChannels; j++) {
        const channelData = buffer.getChannelData(j);
        for (let i = 0; i < buffer.length; i++) {
            mono[i] += channelData[i];
        }
    }
    return mono;
};
export const goertzel = (signal, freq, sampleRate, offset, n) => {
    const nF = freq / sampleRate;
    const coeff = 2.0 * Math.cos(2.0 * Math.PI * nF);
    let s0 = 0.0;
    let s1 = 0.0;
    for (let i = 0; i < n; ++i) {
        const j = offset + i;
        const s = j >= signal.level ? 0.0 : signal[j] + coeff * s0 - s1;
        s1 = s0;
        s0 = s;
    }
    return Math.sqrt(s1 * s1 + s0 * s0 - coeff * s0 * s1) / (n / 2);
};

// TODO Numerical unstable for long signals
// Although read https://www.dsprelated.com/showarticle/796.php
export class Goertzel {
    constructor(freq, sampleRate) {
        const nF = freq / sampleRate;
        this.coeff = 2.0 * Math.cos(2.0 * Math.PI * nF);
        this.s0 = 0.0;
        this.s1 = 0.0;
    }

    pushAndPop(value) {
        const s = value + this.coeff * this.s0 - this.s1;
        this.s1 = this.s0;
        this.s0 = s;
        return Math.sqrt(this.s1 * this.s1 + this.s0 * this.s0 - this.coeff * this.s0 * this.s1);
    }
}

export class RMS {
    constructor(n) {
        this.n = n | 0;
        this.inv = 1.0 / this.n;
        this.values = new Float32Array(this.n);
        this.index = 0 | 0;
        this.sum = 0.0;
    }

    pushPop(squared) {
        this.sum -= this.values[this.index];
        this.sum += squared;
        this.values[this.index] = squared;
        if (++this.index === this.n) this.index = 0;
        return 0.0 >= this.sum ? 0.0 : Math.sqrt(this.sum * this.inv);
    }

    clear() {
        this.values.fill(0.0);
        this.sum = 0.0;
        this.index = 0 | 0;
    }
}

export class Random {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        return this.seed = this.seed * 16807 % 2147483647;
    };

    nextFloat() {
        return (this.next() - 1.0) / 2147483646.0;
    };

    nextInt(limit) {
        return this.next() % limit;
    }
}

// http://werner.yellowcouch.org/Papers/fastenv12/index.html
export class ExpCurveAlgorithm {
    constructor() {
        this.multiplier = 1.0;
        this.delta = 0.0;

        this.y1 = 0.0;
        this.x2 = 0.0;
        this.dy = 0.0;
        this.cstA = 0.0;
        this.cstD = 0.0;
        this.cstE = 0.0;
        this.branch = 0 | 0;
    }

    byHalfValue(x2, y1, ym, y2) {
        if (y2 === y1)
            this.byBend(x2, y1, 0.5, y1);
        else {
            this.byBend(x2, y1, (ym - y1) / (y2 - y1), y2);
        }
    }

    byBend(x2, y1, bend, y2) {
        this.dy = y2 - y1;
        this.y1 = y1;
        this.x2 = x2;
        if (bend > 0.499999 && bend < 0.500001) {
            this.multiplier = 1;
            this.delta = this.dy / x2;
            this.branch = 2 | 0;
        }
        else {
            const onemb = 1 - bend;
            const onembs = onemb * onemb;
            const onem2b = 1 - bend - bend;
            const bends = bend * bend;
            const s = onemb / bend;
            this.multiplier = Math.pow(s, 2.0 / x2);
            const s2 = s * s;
            this.delta = (y2 - y1 * s2) * (this.multiplier - 1.0) / (s2 - 1.0);
            this.cstA = (y1 * onembs - y2 * bends) / onem2b;
            const B = this.dy * bends / onem2b;
            this.cstD = 2.0 * Math.log(s) / x2;
            this.cstE = Math.log(Math.abs(B));
            if (B < 0.0) this.branch = 1 | 0;
            else this.branch = 0 | 0;
        }
    }

    y(x) {
        if (this.branch === 0)
            return this.cstA + Math.exp(this.cstD * x + this.cstE);
        else if (this.branch === 1)
            return this.cstA - Math.exp(this.cstD * x + this.cstE);
        else
            return this.y1 + x * this.dy / this.x2;
    }

    x(y) {
        if (this.branch === 0)
            return (Math.log(y - this.cstA) - this.cstE) / this.cstD;
        else if (this.branch === 1)
            return (Math.log(this.cstA - y) - this.cstE) / this.cstD;
        else // Use a linear approximation
            return (y - this.y1) * this.x2 / this.dy;
    }
}

export class ExpCurvePoint {
    constructor(time, value, slope) {
        this.time = time;
        this.value = value;
        this.slope = slope || 0.5;
    }
}

export const normalise = (array, limit) => {
    let max = 0.0;
    for (let i = 0; i < array.length; i++) {
        max = Math.max(Math.abs(array[i]), max);
    }
    if (max < (limit || 1.0)) {
        return array;
    }
    const scale = 1.0 / max;
    for (let i = 0; i < array.length; i++) {
        array[i] *= scale;
    }
    return array;
};
export const valid = (array) => {
    for (let i = 0; i < array.length; i++) {
        if (isNaN(array[i])) {
            return false;
        }
    }
    return true;
};
export const sigmoid = (target, amount) => {
    const length = target.length;
    for (let i = 0; i < length; i++) {
        const x = i / length * 2.0 - 1.0;
        target[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return target;
};

export class Windows {
    static generate(type, n) {
        const values = new Float32Array(n);
        switch (type) {
            case Windows.Bartlett: {
                const n2 = (n >> 1) - 1;
                let i = 0;
                for (; i <= n2; ++i)
                    values[i] = 2.0 * i / (n - 1.0);
                for (; i < n; ++i)
                    values[i] = 2.0 - 2.0 * i / (n - 1.0);
                return values;
            }
            case Windows.Blackman: {
                const a = Math.PI / (n - 1);
                const c = 2.0 * a;
                const d = 4.0 * a;
                for (let i = 0; i < n; ++i)
                    values[i] = 0.42323 - 0.49755 * Math.cos(c * i) + 0.07922 * Math.cos(d * i);
                return values;
            }
            case Windows.BlackmanHarris: {
                const a = Math.PI / (n - 1);
                const c = 2.0 * a;
                const d = 4.0 * a;
                const e = 6.0 * a;
                for (let i = 0; i < n; ++i)
                    values[i] = 0.35875 - 0.48829 * Math.cos(c * i) + 0.14128 * Math.cos(d * i) - 0.01168 * Math.cos(e * i);
                return values;
            }
            case Windows.Hamming: {
                const a = Math.PI / (n - 1);
                const c = 2.0 * a;
                for (let i = 0; i < n; ++i)
                    values[i] = 0.54 - 0.46 * Math.cos(c * i);
                return values;
            }
            case Windows.Hanning: {
                const a = Math.PI / (n - 1);
                const c = 2.0 * a;
                for (let i = 0; i < n; ++i)
                    values[i] = 0.5 - 0.5 * Math.cos(c * i);
                return values;
            }
        }
        throw new Error("Unknown type: " + type);
    }
}

Windows.Bartlett = 0;
Windows.Blackman = 1;
Windows.BlackmanHarris = 2;
Windows.Hamming = 3;
Windows.Hanning = 4;

// Fragments audio block to enable sample-exact event execution
export class EventReceiver {
    constructor(onEvent, onAudioProcess) {
        this.onEvent = onEvent;
        this.onAudioProcess = onAudioProcess;

        this.events = [];
        this.needsSorting = false;
    }

    enqueue(event) {
        this.events.push(event);
        this.needsSorting = 1 < this.events.length;
    }

    fragment(inputs, outputs, currentTime) {
        const events = this.events;
        if (this.needsSorting) {
            events.sort((a, b) => a.time > b.time ? 1 : a.time < b.time ? -1 : 0);
            this.needsSorting = false;
        }
        let index = 0;
        let event;
        while (event = events[0]) {
            const diff = event.time - currentTime;
            const frames = (diff * sampleRate) | 0;
            if (RenderQuantum > frames) {
                if (0 < frames) {
                    this.onAudioProcess(inputs, outputs, index, index + frames);
                    index += frames;
                }
                this.onEvent(event);
                events.shift();
            } else {
                break;
            }
        }
        if (index < RenderQuantum) {
            this.onAudioProcess(inputs, outputs, index, RenderQuantum);
        }
        return true;
    }
}

// waa-automation util
// https://www.w3.org/TR/webaudio/#dom-audioparam-settargetattime
export const setTargetWithin = ((param, startValue, targetValue, startTime, endTime, timeConstant) => {
    const solve = (v0, v, t0, t, tc) => {
        const tmp = Math.exp((t0 - t) / tc);
        return (tmp * v0 - v) / (tmp - 1.0);
    };
    return (param, startValue, targetValue, startTime, endTime, timeConstant) => {
        param.setTargetAtTime(solve(startValue, targetValue, startTime, endTime, timeConstant), startTime, timeConstant);
        param.setValueAtTime(targetValue, endTime);
    };
})();

export class FFT {
    static reverse(i) {
        i = (i & 0x55555555) << 1 | (i >>> 1) & 0x55555555;
        i = (i & 0x33333333) << 2 | (i >>> 2) & 0x33333333;
        i = (i & 0x0f0f0f0f) << 4 | (i >>> 4) & 0x0f0f0f0f;
        i = (i << 24) | ((i & 0xff00) << 8) | ((i >>> 8) & 0xff00) | (i >>> 24);
        return i;
    };

    constructor(n) {
        this.n = n;

        const halfN = n / 2;
        this.levels = (32 - Math.floor(Math.log2(n))) | 0;
        this.cosTable = new Float32Array(halfN);
        this.sinTable = new Float32Array(halfN);
        for (let i = 0; i < halfN; i++) {
            const angle = 2.0 * Math.PI * i / n;
            this.cosTable[i] = Math.cos(angle);
            this.sinTable[i] = Math.sin(angle);
        }
    }

    process(real, imag) {
        let i, j, k, temp;
        for (let i = 0 | 0; i < this.n; ++i) {
            j = FFT.reverse(i) >>> this.levels;
            if (j > i) {
                temp = real[i];
                real[i] = real[j];
                real[j] = temp;
                temp = imag[i];
                imag[i] = imag[j];
                imag[j] = temp;
            }
        }
        const cosTable = this.cosTable;
        const sinTable = this.sinTable;
        for (let size = 2 | 0; size <= this.n; size <<= 1) {
            const hs = size >> 1;
            const ts = this.n / size;
            for (i = 0 | 0; i < this.n; i += size) {
                const m = i + hs;
                for (j = i, k = 0; j < m; j++, k = (k + ts) | 0) {
                    const idx = (j + hs) | 0;
                    const cos = cosTable[k];
                    const sin = sinTable[k];
                    const reali = real[idx];
                    const imagi = imag[idx];
                    const pre = reali * cos + imagi * sin;
                    const pim = imagi * cos - reali * sin;
                    const real2 = real[j];
                    const imag2 = imag[j];
                    real[idx] = real2 - pre;
                    imag[idx] = imag2 - pim;
                    real[j] = real2 + pre;
                    imag[j] = imag2 + pim;
                }
            }
            if (size === this.n) {
                break;
            }
        }
    }
}