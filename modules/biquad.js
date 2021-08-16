export class Biquad {
    static lowPass(target, fc, fs, bandwidth) {
        const omega = Math.PI * 2.0 * fc / fs;
        const sn = Math.sin(omega);
        const cs = Math.cos(omega);
        const alpha = sn / (2.0 * bandwidth);
        const b0 = (1.0 - cs) / 2.0;
        const b1 = 1.0 - cs;
        const b2 = (1.0 - cs) / 2.0;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * cs;
        const a2 = 1.0 - alpha;
        target.set(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
        return target;
    }

    static highPass(target, fc, fs, bandwidth) {
        const omega = Math.PI * 2.0 * fc / fs;
        const sn = Math.sin(omega);
        const cs = Math.cos(omega);
        const alpha = sn / (2.0 * bandwidth);
        const b0 = (1.0 + cs) / 2.0;
        const b1 = -(1.0 + cs);
        const b2 = (1.0 + cs) / 2.0;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * cs;
        const a2 = 1.0 - alpha;
        target.set(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
        return target;
    }

    static peakBand(target, dbGain, fc, fs, bandwidth) {
        const A = Math.pow(10.0, dbGain / 40.0);
        const omega = Math.PI * 2.0 * fc / fs;
        const sn = Math.sin(omega);
        const cs = Math.cos(omega);
        const alpha = sn * Math.sinh(Math.log(2.0) * 0.5 * bandwidth * omega / sn);
        const b0 = 1.0 + (alpha * A);
        const b1 = -2.0 * cs;
        const b2 = 1.0 - (alpha * A);
        const a0 = 1.0 + (alpha / A);
        const a1 = -2.0 * cs;
        const a2 = 1.0 - (alpha / A);
        target.set(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
        return target;
    }

    static bandBand(target, fc, fs, bw) {
        const q = fc / ((fc + bw * 0.5) - (fc - bw * 0.5));
        const omega = Math.PI * 2.0 * fc / fs;
        const alpha = Math.sin(omega) / (2.0 * q);
        const b0 = alpha;
        const b1 = 0.0;
        const b2 = -alpha;
        const a0 = 1.0 + alpha;
        const a1 = -2.0 * Math.cos(omega);
        const a2 = 1.0 - alpha;
        target.set(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
        return target;
    }

    static lowShelf(target, dbGain, fc, fs, shelfRate) {
        const A = Math.pow(10.0, dbGain / 40.0);
        const omega = Math.PI * 2.0 * fc / fs;
        const sn = Math.sin(omega);
        const cs = Math.cos(omega);
        const alpha = sn / 2.0 * Math.sqrt((A + 1.0 / A) * (1.0 / shelfRate - 1.0) + 2.0);
        const beta = 2.0 * Math.sqrt(A) * alpha;
        const b0 = A * ((A + 1.0) - (A - 1.0) * cs + beta);
        const b1 = 2.0 * A * ((A - 1.0) - (A + 1.0) * cs);
        const b2 = A * ((A + 1.0) - (A - 1.0) * cs - beta);
        const a0 = (A + 1.0) + (A - 1.0) * cs + beta;
        const a1 = -2.0 * ((A - 1.0) + (A + 1.0) * cs);
        const a2 = (A + 1.0) + (A - 1.0) * cs - beta;
        target.set(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
        return target;
    }

    static highShelf(target, dbGain, fc, fs, shelfRate) {
        const A = Math.pow(10.0, dbGain / 40.0);
        const omega = Math.PI * 2.0 * fc / fs;
        const sn = Math.sin(omega);
        const cs = Math.cos(omega);
        const alpha = sn / 2.0 * Math.sqrt((A + 1.0 / A) * (1.0 / shelfRate - 1.0) + 2.0);
        const beta = 2.0 * Math.sqrt(A) * alpha;
        const b0 = A * ((A + 1.0) + (A - 1.0) * cs + beta);
        const b1 = -2.0 * A * ((A - 1.0) + (A + 1.0) * cs);
        const b2 = A * ((A + 1.0) + (A - 1.0) * cs - beta);
        const a0 = (A + 1.0) - (A - 1.0) * cs + beta;
        const a1 = 2.0 * ((A - 1.0) - (A + 1.0) * cs);
        const a2 = (A + 1.0) - (A - 1.0) * cs - beta;
        target.set(b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0);
        return target;
    }

    constructor() {
        this.a0 = 0.0;
        this.a1 = 0.0;
        this.a2 = 0.0;
        this.a3 = 0.0;
        this.a4 = 0.0;
        this.x1 = this.x2 = this.y1 = this.y2 = 0.0;
    }

    set(a0, a1, a2, a3, a4) {
        this.a0 = a0;
        this.a1 = a1;
        this.a2 = a2;
        this.a3 = a3;
        this.a4 = a4;
    }

    reset() {
        this.x1 = this.x2 = this.y1 = this.y2 = 0.0;
    }

    process(value) {
        const out = this.a0 * value + this.a1 * this.x1 + this.a2 * this.x2 - this.a3 * this.y1 - this.a4 * this.y2;
        this.x2 = this.x1;
        this.x1 = value;
        this.y2 = this.y1;
        this.y1 = out;
        return out;
    }
}