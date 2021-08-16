import * as N from '../modules/neutrons.js';

export class StereoMeter extends AudioWorkletNode {
    static load(context) {
        return context.audioWorklet.addModule("./worklets/StereoMeterProcessor.js");
    }

    constructor(context, height) {
        super(context, "StereoMeterProcessor", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });

        this.minDb = -48.0;
        this.maxDb = 3.0;
        this.labelStepsDb = 3.0;

        this.maxPeaks = new Float32Array(2);
        this.maxSquares = new Float32Array(2);
        this.maxPeakHoldValue = new Float32Array(2);
        this.releasePeakHoldTime = new Float32Array(2);
        this.peakHoldDuration = 1000.0;
        this.clipHoldDuration = 2000.0;

        this.width = 48;
        this.height = height || 288;
        this.meterPadding = 12;
        this.meterHeight = this.height - this.meterPadding * 2.0;
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = this.width + "px";
        this.canvas.style.height = this.height + "px";
        this.canvas.style.backgroundColor = "rgba(30,30,30)";
        this.canvas.style.borderRadius = "3px";
        this.graphics = this.canvas.getContext("2d");

        const green = "rgb(0,240,0)";
        const yellow = "rgb(248,248,0)";
        const red = "rgb(256,16,0)";
        this.gradient = this.graphics.createLinearGradient(0, this.meterPadding + this.meterHeight, 0, this.meterPadding);
        this.gradient.addColorStop(0.0, green);
        this.gradient.addColorStop(this.dbToNorm(-9.0), green);
        this.gradient.addColorStop(this.dbToNorm(-9.0), yellow);
        this.gradient.addColorStop(this.dbToNorm(0.0), yellow);
        this.gradient.addColorStop(this.dbToNorm(0.0), red);
        this.gradient.addColorStop(1.0, red);
        this.scale = NaN;

        this.port.onmessage = event => {
            const now = performance.now();
            const data = event.data;
            this.maxSquares = data[0];
            this.maxPeaks = data[1];
            for (let i = 0; i < 2; ++i) {
                const maxPeak = this.maxPeaks[i];
                if (this.maxPeakHoldValue[i] <= maxPeak) {
                    this.maxPeakHoldValue[i] = maxPeak;
                    this.releasePeakHoldTime[i] = now + (1.0 < maxPeak ? this.clipHoldDuration : this.peakHoldDuration);
                }
            }
        };
        this.updater = () => this.update();
        this.update();
    }

    get domElement() {
        return this.canvas;
    }

    attachToScreen() {
        this.domElement.style.position = "absolute";
        this.domElement.style.top = "112px";
        this.domElement.style.right = "48px";
        document.body.appendChild(this.domElement);
    }

    update() {
        const graphics = this.graphics;
        const densityChanged = this.scale !== devicePixelRatio;
        if (densityChanged) {
            this.scale = devicePixelRatio;
            this.canvas.width = this.width * this.scale;
            this.canvas.height = this.height * this.scale;
        }
        graphics.save();
        graphics.scale(this.scale, this.scale);
        if (densityChanged) {
            this.renderScale();
        }
        graphics.fillStyle = "#111";
        const maxGain = N.dbToGain(this.maxDb);
        this.renderMeter(maxGain, 8, 8);
        this.renderMeter(maxGain, 18, 8);

        graphics.fillStyle = this.gradient;
        graphics.globalAlpha = 0.7;
        this.renderMeter(this.maxPeaks[0], 8, 8);
        this.renderMeter(this.maxPeaks[1], 18, 8);
        graphics.globalAlpha = 1.0;
        this.renderMeter(this.maxSquares[0], 8, 8);
        this.renderMeter(this.maxSquares[1], 18, 8);
        const now = performance.now();
        for (let i = 0; i < 2; ++i) {
            if (0.0 <= now - this.releasePeakHoldTime[i]) {
                this.maxPeakHoldValue[i] = 0.0;
            } else {
                const db = Math.min(this.maxDb, N.gainToDb(this.maxPeakHoldValue[i]));
                if (db >= this.minDb) {
                    graphics.fillStyle = 0.0 < db ? "rgb(240,0,0)" : "rgb(240,240,0)";
                    graphics.fillRect(this.meterPadding + 8 + i * 10, this.dbToY(db), 8, 1);
                }
            }
        }
        graphics.restore();
        window.requestAnimationFrame(this.updater);
    }

    renderScale() {
        const graphics = this.graphics;
        graphics.clearRect(0, 0, this.width, this.height);
        graphics.font = "8px Open sans";
        graphics.textBaseline = "middle";
        graphics.textAlign = "right";
        for (let db = this.maxDb; db >= this.minDb; db -= this.labelStepsDb) {
            const y = this.dbToY(db);
            graphics.fillStyle = db <= 0 ? "rgb(160,160,160)" : "rgb(255,96,16)";
            graphics.fillText(db === this.minDb ? "db" : db.toString(10), this.meterPadding + 3, y);
        }
    }

    renderMeter(gain, x, w) {
        const db = N.gainToDb(gain);
        if (db >= this.minDb) {
            const height = Math.floor(this.dbToNorm(Math.min(db, this.maxDb)) * this.meterHeight);
            this.graphics.fillRect(this.meterPadding + x, this.meterPadding + this.meterHeight - height, w, height + 1);
        }
    }

    dbToY(db) {
        return this.meterPadding + Math.round(this.meterHeight - this.dbToNorm(db) * this.meterHeight);
    }

    dbToNorm(db) {
        return (db - this.minDb) / (this.maxDb - this.minDb);
    }
}