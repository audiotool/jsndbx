class FFT {
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