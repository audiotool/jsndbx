import {hsla} from "./standard.js";

export class PadDisplay {
    /**
     * Not the profile used for the sound generation.
     * It is rather tweaked to emphasize the features.
     */
    static profile(harmonic, position) {
        let x = (position - harmonic.position) / harmonic.bandWidth;
        x *= x;
        return x > 14.71280603 ? 0.0 : Math.exp(-x) * harmonic.level;
    }

    constructor(sound) {
        this.sound = sound;
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "128px";
        this.context = this.canvas.getContext("2d");
        this.range = 0.0;
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.devicePixelRatio = window.devicePixelRatio;
        this.version = sound.version;
        this.sum = null;
        const update = _ => {
            if (
                this.width !== this.canvas.clientWidth ||
                this.height !== this.canvas.clientHeight ||
                this.devicePixelRatio !== window.devicePixelRatio ||
                this.version !== sound.version) {
                this.width = this.canvas.clientWidth;
                this.height = this.canvas.clientHeight;
                this.devicePixelRatio = window.devicePixelRatio;
                this.version = sound.version;
                this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
                this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
                this.update();
            }
            window.requestAnimationFrame(update);
        };
        window.requestAnimationFrame(update);
    }

    update() {
        if (null === this.sum || this.width !== this.sum.length) {
            this.sum = new Float32Array(this.width);
        }
        const sound = this.sound;
        const harmonics = sound.harmonics;
        const canvas = this.canvas;
        const context = this.context;
        const width = canvas.width;
        const height = canvas.height;
        const devicePixelRatio = window.devicePixelRatio;
        const sum = this.sum;
        this.range = sound.numHarmonics.value * sound.distance.value + 4;
        context.clearRect(0, 0, width, height);
        context.save();
        context.scale(devicePixelRatio, devicePixelRatio);
        context.translate(0.5, 0.5);
        context.globalCompositeOperation = "screen";
        for (let i = 0; i < harmonics.length; ++i) {
            const harmonic = harmonics[i];
            const hue = harmonic.position / 32.0;
            context.fillStyle = hsla(hue, 0.7, 0.25, 1.0);
            context.strokeStyle = hsla(hue, 0.7, 0.5, 1.0);
            context.beginPath();
            let prev = this.xToHarmonic(0);
            let profile = PadDisplay.profile(harmonic, prev);
            let py = this.gainToY(profile);
            context.moveTo(-1, height);
            context.lineTo(-1, py);
            for (let x = 0; x < width; ++x) {
                const next = this.xToHarmonic(x + 1);
                if (Math.abs(prev - harmonic.position) < next - prev) {
                    profile = harmonic.level;
                } else {
                    profile = PadDisplay.profile(harmonic, prev);
                }
                sum[x] += profile;
                context.lineTo(x, py);
                py = this.gainToY(profile);
                prev = next;
            }
            context.lineTo(width, py);
            context.lineTo(width, height);
            context.stroke();
            context.fill();
        }

        let max = 0.0;
        for (let i = 0; i < sum.length; ++i) {
            if (max < sum[i]) {
                max = sum[i];
            }
        }
        const scale = 1.0 / max;
        for (let i = 0; i < sum.length; ++i) {
            sum[i] *= scale;
        }
        context.beginPath();
        context.strokeStyle = "rgba(255,255,255,1.0)";
        context.globalCompositeOperation = "add";
        let profile = sum[0];
        let py = this.gainToY(profile);
        context.moveTo(-1, py);
        for (let x = 0; x < width; ++x) {
            context.lineTo(x, py);
            profile = sum[x];
            sum[x] = 0.0;
            py = this.gainToY(profile);
        }
        context.lineTo(width, py);
        context.stroke();
        context.restore();
    }

    xToHarmonic(x) {
        const width = this.width;
        return x / width * this.range;
    }

    gainToY(value) {
        const height = this.height;
        return height - height * value;
    }

    get domElement() {
        return this.canvas;
    }
}