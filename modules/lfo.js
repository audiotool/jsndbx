import {Bool, Linear, LinearInt, Exp, NoFloat, PrintMapping} from "./mapping.js";
import {ParameterBuilder} from "./parameter.js";
import {RenderQuantum, PI_2, Random} from "./neutrons.js";

export class LFOFormat {
    constructor(sampleRate, onChange) {
        const setting = new LFOSetting();

        const updateShape = parameter => setting.shape = parameter.value;
        const updatePeriod = parameter => setting.period = parameter.value / 1000.0;
        const updateRetrigger = parameter => setting.retrigger = parameter.value;

        this.shape = ParameterBuilder.begin("Shape")
            .unit("")
            .valueMapping(LFOFormat.ShapeMapping)
            .printMapping(LFOFormat.ShapePrintMapping)
            .value(LFOSetting.Sine)
            .create();
        this.shape.addCallback(parameter => {
            setting.shape = parameter.value;
            onChange(setting);
        });

        this.period = ParameterBuilder.begin("Rate")
            .unit("Hz")
            .valueMapping(new Exp(10000.0, 10.0))
            .printMapping(PrintMapping.create((mapping, unipolar) => (1000.0 / mapping.y(unipolar)).toFixed(1)))
            .value(500.0)
            .create();
        this.period.addCallback(parameter => {
            updatePeriod(parameter);
            onChange(setting);
        });

        this.phase = ParameterBuilder.begin("Phase")
            .value(0.0)
            .create();
        this.phase.addCallback(parameter => {
            setting.phase = parameter.value;
            onChange(setting);
        });

        this.retrigger = ParameterBuilder.begin("Retrigger")
            .unit("")
            .valueMapping(Bool.Default)
            .printMapping(PrintMapping.create((mapping, unipolar) => unipolar >= 0.5 ? "On" : "Off"))
            .value(true)
            .create();
        this.retrigger.addCallback(parameter => {
            updateRetrigger(parameter);
            onChange(setting);
        });

        updateShape(this.shape);
        updatePeriod(this.period);
        updateRetrigger(this.retrigger);
        onChange(setting);
    }
}

LFOFormat.ShapeMapping = new LinearInt(0, 4);
LFOFormat.ShapePrintMapping = PrintMapping.create((mapping, unipolar) => ["Sine", "Triangle", "Sawtooth", "Square", "Noise"][mapping.y(unipolar)]);

export class LFOSetting {
    constructor() {
        this.shape = LFOSetting.Sine;
        this.period = 0.0;
        this.phase = 0.0;
        this.retrigger = true;
        this.version = 0 | 0;
    }

    copyFrom(setting) {
        this.shape = setting.shape;
        this.period = setting.period;
        this.phase = setting.phase;
        this.retrigger = setting.retrigger;
    }
}

LFOSetting.Sine = 0;
LFOSetting.Triangle = 1;
LFOSetting.Sawtooth = 2;
LFOSetting.Square = 3;
LFOSetting.Noise = 4;

export class LFORunner {
    constructor(setting, sampleRate) {
        this.setting = setting;
        this.sampleRate = sampleRate;
        this.phase = NaN;
        this.random = new Random(0x303909);
        this.coeff = Math.exp(-1.0 / (0.005 * sampleRate));
        this.randomValue = 0.0;
        switch (setting.shape) {
            case LFOSetting.Sine:
            case LFOSetting.Triangle:
            case LFOSetting.Sawtooth:
            case LFOSetting.Square: {
                this.value = 1.0;
                break;
            }
            case LFOSetting.Noise: {
                this.value = this.randomValue = this.random.nextFloat() * 2.0 - 1.0;
                break;
            }
        }
    }

    setTime(time) {
        const setting = this.setting;
        if (setting.retrigger) {
            this.phase = setting.phase;
        } else {
            this.phase = time / setting.period + setting.phase;
            this.phase -= Math.floor(this.phase);
        }
        this.random.seed = (time * 0xFFFFFF)|0;
    }

    process(buffer, rateMod, rateModAmount) {
        const setting = this.setting;
        const phaseIncr = 1.0 / (setting.period * this.sampleRate);

        if (0 <= rateModAmount) {
            const oneMinusRateMod = 1.0 - rateModAmount;
            for (let i = 0; i < RenderQuantum; i++) {
                LFORunner.RateMod[i] = rateMod[i] * rateModAmount + oneMinusRateMod;
            }
        } else {
            const onePlusRateMod = 1.0 + rateModAmount;
            for (let i = 0; i < RenderQuantum; i++) {
                LFORunner.RateMod[i] = (rateMod[i] - 1.0) * rateModAmount + onePlusRateMod;
            }
        }

        switch (setting.shape) {
            case LFOSetting.Sine: {
                for (let i = 0; i < RenderQuantum; i++) {
                    const sample = Math.sin(this.phase * PI_2);
                    this.value = sample + this.coeff * (this.value - sample);
                    this.phase += phaseIncr * LFORunner.RateMod[i];
                    buffer[i] = this.value;
                }
                break;
            }
            case LFOSetting.Triangle: {
                for (let i = 0; i < RenderQuantum; i++) {
                    const x = this.phase;
                    const sample = 1.0 - 4 * Math.abs(Math.floor(x + 0.25) - (x - 0.25));
                    this.value = sample + this.coeff * (this.value - sample);
                    this.phase += phaseIncr * LFORunner.RateMod[i];
                    buffer[i] = this.value;
                }
                break;
            }
            case LFOSetting.Sawtooth: {
                for (let i = 0; i < RenderQuantum; i++) {
                    const x = this.phase;
                    const sample = 2.0 * (x - Math.floor(x + 0.5));
                    this.value = sample + this.coeff * (this.value - sample);
                    this.phase += phaseIncr * LFORunner.RateMod[i];
                    buffer[i] = this.value;
                }
                break;
            }
            case LFOSetting.Square: {
                for (let i = 0; i < RenderQuantum; i++) {
                    const x = this.phase;
                    const sample = x - Math.floor(x + 0.5) < 0.0 ? -1.0 : 1.0;
                    this.value = sample + this.coeff * (this.value - sample);
                    this.phase += phaseIncr * LFORunner.RateMod[i];
                    buffer[i] = this.value;
                }
                break;
            }
            case LFOSetting.Noise: {
                for (let i = 0; i < RenderQuantum; i++) {
                    this.phase += phaseIncr * LFORunner.RateMod[i];
                    if (this.phase >= 1.0) {
                        this.randomValue = this.random.nextFloat() * 2.0 - 1.0;
                        this.phase -= Math.floor(this.phase);
                    }
                    this.value = this.randomValue + this.coeff * (this.value - this.randomValue);
                    buffer[i] = this.value;
                }
                break;
            }
        }
    }
}

LFORunner.RateMod = new Float32Array(RenderQuantum);