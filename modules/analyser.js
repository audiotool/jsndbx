import {ArrayPlotter} from "./plotter.js";
import {Linear, Exp} from "./mapping.js";

export class Analyser {
    constructor(context, spectrumMode) {
        this.context = context;
        this.node = context.createAnalyser();
        this.node.minDecibels = -72.0;
        this.node.maxDecibels = 0.0;
        this.node.fftSize = 2048;

        this.root = document.createElement("div");
        this.root.style.width = "512px";
        this.root.style.height = "256px";
        this.root.style.backgroundColor = "#202020";
        this.root.style.borderRadius = "1px";
        this.root.style.position = "relative";
        this.root.style.boxSizing = "border-box";

        this.labelCanvas = document.createElement("canvas");
        this.labelCanvas.style.position = "absolute";
        this.labelCanvas.style.width = "512px";
        this.labelCanvas.style.height = "256px";
        this.labelContext = this.labelCanvas.getContext("2d");
        this.root.appendChild(this.labelCanvas);

        this.plotterCanvas = document.createElement("canvas");
        this.plotterCanvas.style.margin = "32px";
        this.plotterCanvas.style.position = "absolute";
        this.plotterCanvas.style.width = "448px";
        this.plotterCanvas.style.height = "192px";
        this.plotterContext = this.plotterCanvas.getContext("2d");
        this.root.appendChild(this.plotterCanvas);

        this.dbMapping = new Linear(0.0, -72.0);
        this.freqMapping = new Exp(20.0, 20000.0);

        this.width = NaN;
        this.height = NaN;
        this.devicePixelRatio = NaN;
        this.values = new Float32Array(1024);
        this.spectrumMode = spectrumMode;
        this.$headerText = "SPECTRUM";

        this.overlayCallback = (canvas, graphics) => {};

        this.start();
    }

    setSpectrumMode(value) {
        if (this.spectrumMode === value) {
            return;
        }
        this.spectrumMode = value;
        this.drawLabels();
    }

    setHeader(text) {
        this.$headerText = text;
        this.width = NaN;
        this.height = NaN;
        this.devicePixelRatio = NaN;
    }

    drawLabels() {
        const context = this.labelContext;
        const pixelRatio = window.devicePixelRatio;
        const width = this.width;
        const height = this.height;
        context.save();
        context.scale(pixelRatio, pixelRatio);
        context.clearRect(0, 0, width, height);
        context.beginPath();
        context.strokeStyle = "#777";
        context.globalAlpha = 0.3;
        if (this.spectrumMode) {
            for (let hz of Analyser.DIVIDERS) {
                const x = this.freqMapping.x(hz) * (width - 64);
                context.moveTo(32.5 + x, 32);
                context.lineTo(32.5 + x, height - 32);
            }
        } else {
            for (let x = 0; x < 15; x++) {
                context.moveTo(32.5 + x * 32, 32);
                context.lineTo(32.5 + x * 32, height - 32);
            }
        }

        for (let y = 0; y < 7; y++) {
            context.moveTo(32, 32.5 + y * 32);
            context.lineTo(width - 32, 32.5 + y * 32);
        }
        context.stroke();
        context.globalAlpha = 1.0;
        context.fillStyle = "#CCC";
        if (this.spectrumMode) {
            context.font = "14px Open sans";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText(this.$headerText, width * 0.5, 6.0);
            context.font = "8px Open sans";
            for (let hz of Analyser.DIVIDERS) {
                const x = this.freqMapping.x(hz) * (width - 64);
                if (hz < 1000) {
                    context.fillText(hz + "Hz", 32.5 + x, height - 24);
                } else {
                    context.fillText((Math.round(hz / 100) / 10.0).toFixed(1) + "kHz", 32.5 + x, height - 24);
                }
            }
            context.textBaseline = "middle";
            context.textAlign = "right";
            for (let y = 0; y <= 6; y++) {
                const db = Math.round(this.dbMapping.y(y / 6));
                context.fillText(db + "db", 26, 32.5 + y * 32);
            }
        } else {
            context.font = "14px Open sans";
            context.textBaseline = "top";
            context.textAlign = "center";
            context.fillText("WAVEFORM", width * 0.5, 6.0);
            context.font = "8px Open sans";
            context.textBaseline = "middle";
            context.textAlign = "right";
            context.fillText("1.0", 26, 32.5);
            context.fillText("0.0", 26, 128.5);
            context.fillText("-1.0", 26, 224.5);
        }
        context.restore();
    }

    update() {
        const canvas = this.plotterCanvas;
        const graphics = this.plotterContext;
        const width = canvas.width;
        const height = canvas.height;
        const node = this.node;
        const values = this.values;
        if (this.spectrumMode) {
            node.getFloatFrequencyData(values);
        } else {
            node.getFloatTimeDomainData(values);
        }
        graphics.clearRect(0, 0, width, height);
        graphics.beginPath();
        if (this.spectrumMode) {
            graphics.fillStyle = "rgba(40, 229, 255, 0.5)";
            graphics.strokeStyle = "rgba(40, 229, 255, 1.0)";
            this.drawSpectrum(values, graphics, width + 1, height);
            graphics.stroke();
            graphics.fill();
        } else {
            graphics.fillStyle = "rgba(40, 229, 255, 1.0)";
            ArrayPlotter.renderOversampled(graphics, values, 1, width, 0, height + 1, 0, node.frequencyBinCount, -1.0, 1.0);
        }
        this.overlayCallback(canvas, graphics);
    }

    drawSpectrum(spectrum, path, width, height) {
        const numBins = spectrum.length;
        const freqStep = this.context.sampleRate / (numBins << 1);
        let x0 = 0;
        let lastEnergy = spectrum[0];
        let currentEnergy = lastEnergy;
        path.moveTo(-1, height);
        path.lineTo(-1, this.dbMapping.x(lastEnergy) * height);
        for (let i = 1; i < numBins; ++i) {
            const energy = spectrum[i];
            if (currentEnergy > energy) {
                currentEnergy = energy;
            }
            let x1 = Math.floor(this.freqMapping.x(i * freqStep) * width);
            if (x1 > width) {
                i = numBins;
                x1 = width;
            }
            if (x0 < x1) {
                const xn = x1 - x0;
                if (2 >= xn) {
                    path.lineTo(x1, this.dbMapping.x(currentEnergy) * height);
                } else {
                    const scale = 1.0 / xn;
                    const y1 = this.dbMapping.x(lastEnergy) * height;
                    const y2 = this.dbMapping.x(currentEnergy) * height;
                    for (let x = 1; x <= xn; ++x) {
                        path.lineTo(x0 + x, this.cosine(y1, y2, x * scale));
                    }
                }
                lastEnergy = currentEnergy;
                currentEnergy = 0.0;
            }
            x0 = x1;
        }
        path.lineTo(width, height);
    }

    cosine(y1, y2, mu) {
        const mu2 = (1.0 - Math.cos(mu * Math.PI)) * 0.5;
        return y1 * (1.0 - mu2) + y2 * mu2;
    }

    get domElement() {
        return this.root;
    }

    start() {
        const update = () => {
            const devicePixelRatio = window.devicePixelRatio;
            if (
                this.width !== this.root.clientWidth ||
                this.height !== this.root.clientHeight ||
                this.devicePixelRatio !== devicePixelRatio) {
                this.width = this.root.clientWidth;
                this.height = this.root.clientHeight;
                this.devicePixelRatio = devicePixelRatio;
                this.labelCanvas.width = this.root.clientWidth * devicePixelRatio;
                this.labelCanvas.height = this.root.clientHeight * devicePixelRatio;
                this.plotterCanvas.width = (this.root.clientWidth - 64) * devicePixelRatio;
                this.plotterCanvas.height = (this.root.clientHeight - 64) * devicePixelRatio;
                this.drawLabels();
            }
            this.update();
            window.requestAnimationFrame(update);
        };
        window.requestAnimationFrame(update);
    }
}

Analyser.DIVIDERS = new Float32Array([20, 36, 60, 100, 160, 260, 430, 740, 1300, 2300, 4000, 7000, 12000, 20000]);