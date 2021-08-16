import {ExpCurveAlgorithm} from "./neutrons.js";
import {Bool, Linear, Exp, OneFloat, PrintMapping} from "./mapping.js";
import {ParameterBuilder} from "./parameter.js";

export class AdsrEnvelopeFormat { // editor format
    constructor(sampleRate, onChange) {
        this.setting = new AdsrEnvelopeSetting();

        let initPhase = false;
        const updateTime = (parameter, setter) => {
            setter.call(this.setting, parameter.value / 1000.0, sampleRate);
            if (!initPhase)
                onChange(this.setting);
        };
        const updateDirect = (parameter, setter) => {
            setter.call(this.setting, parameter.value);
            if (!initPhase)
                onChange(this.setting);
        };

        this.attackTime = ParameterBuilder.begin("Attack")
            .unit("ms")
            .valueMapping(AdsrEnvelopeFormat.TimeMapping)
            .printMapping(OneFloat)
            .value(5)
            .create();
        this.attackTime.addCallback(parameter => updateTime(parameter, this.setting.setAttackTime));

        this.attackBend = ParameterBuilder.begin("Attack Bend")
            .unit("%")
            .valueMapping(AdsrEnvelopeFormat.BendMapping)
            .printMapping(OneFloat)
            .value(0.75)
            .create();
        this.attackBend.addCallback(parameter => updateDirect(parameter, this.setting.setAttackBend));

        this.decayTime = ParameterBuilder.begin("Decay")
            .unit("ms")
            .valueMapping(AdsrEnvelopeFormat.TimeMapping)
            .printMapping(OneFloat)
            .value(200)
            .create();
        this.decayTime.addCallback(parameter => updateTime(parameter, this.setting.setDecayTime));

        this.decayBend = ParameterBuilder.begin("Decay Bend")
            .unit("%")
            .valueMapping(AdsrEnvelopeFormat.BendMappingInverse)
            .printMapping(OneFloat)
            .value(0.75)
            .create();
        this.decayBend.addCallback(parameter => updateDirect(parameter, this.setting.setDecayBend));

        this.decayLoop = ParameterBuilder.begin("Decay Loop")
            .unit("%")
            .valueMapping(Bool.Default)
            .printMapping(PrintMapping.create((mapping, unipolar) => mapping.y(unipolar) ? "on" : "off"))
            .value(false)
            .create();
        this.decayLoop.addCallback(parameter => updateDirect(parameter, this.setting.setDecayLoop));

        this.sustainValue = ParameterBuilder.begin("Sustain")
            .unit("%")
            .valueMapping(AdsrEnvelopeFormat.SustainMapping)
            .printMapping(OneFloat)
            .value(0.5)
            .create();
        this.sustainValue.addCallback(parameter => updateDirect(parameter, this.setting.setSustainLevel));

        this.releaseTime = ParameterBuilder.begin("Release")
            .unit("ms")
            .valueMapping(AdsrEnvelopeFormat.TimeMapping)
            .printMapping(OneFloat)
            .value(2000)
            .create();
        this.releaseTime.addCallback(parameter => updateTime(parameter, this.setting.setReleaseTime));

        this.releaseBend = ParameterBuilder.begin("Release Bend")
            .unit("")
            .valueMapping(AdsrEnvelopeFormat.BendMappingInverse)
            .printMapping(OneFloat)
            .value(0.75)
            .create();
        this.releaseBend.addCallback(parameter => updateDirect(parameter, this.setting.setReleaseBend));

        this.releaseEnabled = ParameterBuilder.begin("Release Enabled")
            .unit("")
            .valueMapping(Bool.Default)
            .printMapping(PrintMapping.create((mapping, unipolar) => mapping.y(unipolar) ? "on" : "off"))
            .value(true)
            .create();
        this.releaseEnabled.addCallback(parameter => updateDirect(parameter, this.setting.setReleaseEnabled));

        initPhase = true;
        updateTime(this.attackTime, this.setting.setAttackTime);
        updateDirect(this.attackBend, this.setting.setAttackBend);
        updateTime(this.decayTime, this.setting.setDecayTime);
        updateDirect(this.decayBend, this.setting.setDecayBend);
        updateDirect(this.decayLoop, this.setting.setDecayLoop);
        updateDirect(this.sustainValue, this.setting.setSustainLevel);
        updateTime(this.releaseTime, this.setting.setReleaseTime);
        updateDirect(this.releaseBend, this.setting.setReleaseBend);
        initPhase = false;
        onChange(this.setting);
    }
}

AdsrEnvelopeFormat.TimeMapping = new Exp(1, 9999);
AdsrEnvelopeFormat.BendMapping = new Linear(0.01, 0.99);
AdsrEnvelopeFormat.BendMappingInverse = new Linear(0.99, 0.01);
AdsrEnvelopeFormat.SustainMapping = new Linear(0.0, 1.0);

export class AdsrEnvelopeSetting { // cloneable object to be sent to worklet or worker
    constructor() {
        this.attackFrames = 0 | 0;
        this.attackBend = 0.5;
        this.decayFrames = 0 | 0;
        this.decayBend = 0.5;
        this.decayLoop = false;
        this.sustainValue = 0.0;
        this.releaseFrames = 0 | 0;
        this.releaseBend = 0.5;
        this.releaseEnabled = true;
        this.version = 0 | 0;
    }

    copyFrom(setting) {
        this.attackFrames = setting.attackFrames;
        this.attackBend = setting.attackBend;
        this.decayFrames = setting.decayFrames;
        this.decayBend = setting.decayBend;
        this.decayLoop = setting.decayLoop;
        this.sustainValue = setting.sustainValue;
        this.releaseFrames = setting.releaseFrames;
        this.releaseBend = setting.releaseBend;
        this.releaseEnabled = setting.releaseEnabled;
    }

    setAttackTime(seconds, sampleRate) {
        this.attackFrames = (seconds * sampleRate) | 0;
    }

    setAttackBend(value) {
        this.attackBend = value;
    }

    setDecayTime(seconds, sampleRate) {
        this.decayFrames = (seconds * sampleRate) | 0;
    }

    setDecayBend(value) {
        this.decayBend = value;
    }

    setDecayLoop(value) {
        this.decayLoop = value;
    }

    setSustainLevel(level) {
        this.sustainValue = level;
    }

    setReleaseTime(seconds, sampleRate) {
        this.releaseFrames = (seconds * sampleRate) | 0;
    }

    setReleaseBend(value) {
        this.releaseBend = value;
    }

    setReleaseEnabled(value) {
        this.releaseEnabled = value;
    }
}

export class AdsrEnvelopeRunner { // computes the envelope values
    constructor(setting, sampleRate) {
        this.setting = setting;
        this.curve = new ExpCurveAlgorithm();
        this.curve.byBend(setting.attackFrames, 0.0, setting.attackBend, 1.0);
        this.state = AdsrEnvelopeRunner.Attack;
        this.remaining = setting.attackFrames;
        this.interpolation = (AdsrEnvelopeRunner.InterpolationMs * sampleRate) | 0;
        this.value = 0.0;
        this.version = setting.version;
    }

    // TODO Create setter and take current phase into account for smooth changes

    releaseGate() {
        const setting = this.setting;
        if (!setting.releaseEnabled) {
            return;
        }
        switch (this.state) {
            case AdsrEnvelopeRunner.Attack:
            case AdsrEnvelopeRunner.DecayForwards:
            case AdsrEnvelopeRunner.DecayBackwards:
            case AdsrEnvelopeRunner.Sustain: {
                this.curve.byBend(setting.releaseFrames, this.value, setting.releaseBend, 0.0);
                this.state = AdsrEnvelopeRunner.Release;
                this.remaining = setting.releaseFrames;
                break;
            }
        }
    }

    releaseImmediately() {
        switch (this.state) {
            case AdsrEnvelopeRunner.Attack:
            case AdsrEnvelopeRunner.DecayForwards:
            case AdsrEnvelopeRunner.Sustain:
            case AdsrEnvelopeRunner.Release: {
                this.curve.byBend(this.interpolation, this.value, 0.5, 0.0);
                this.state = AdsrEnvelopeRunner.Stop;
                this.remaining = this.interpolation;
                break;
            }
        }
    }

    process(array, n, offset) {
        if (this.version !== this.setting.version) {
            this.version = this.setting.version;
            this.reTarget();
        }
        const curve = this.curve;
        for (let index = 0; index < n;) {
            if (this.state === AdsrEnvelopeRunner.Sustain || this.state === AdsrEnvelopeRunner.Complete) {
                while (index < n) {
                    array[offset + index++] = this.value;
                }
            } else {
                const stop = Math.min(n, index + this.remaining);
                const multiplier = curve.multiplier;
                const delta = curve.delta;
                const processing = stop - index;
                let value = this.value;
                while (index < stop) {
                    array[offset + index++] = value = value * multiplier + delta;
                }
                this.value = value;
                this.remaining -= processing;
                if (0 === this.remaining) {
                    this.switchPhase();
                }
            }
        }
    }

    switchPhase() {
        const setting = this.setting;
        switch (this.state) {
            case AdsrEnvelopeRunner.Attack: {
                this.state = AdsrEnvelopeRunner.DecayForwards;
                this.curve.byBend(setting.decayFrames, 1.0, setting.decayBend, setting.sustainValue);
                this.remaining = setting.decayFrames;
                break;
            }
            case AdsrEnvelopeRunner.DecayForwards: {
                if (setting.decayLoop) {
                    this.state = AdsrEnvelopeRunner.DecayBackwards;
                    this.curve.byBend(setting.decayFrames, setting.sustainValue, setting.decayBend, 1.0);
                    this.remaining = setting.decayFrames;
                } else {
                    this.state = AdsrEnvelopeRunner.Sustain;
                    this.value = setting.sustainValue;
                    this.remaining = 0;
                }
                break;
            }
            case AdsrEnvelopeRunner.DecayBackwards: {
                if (setting.decayLoop) {
                    this.state = AdsrEnvelopeRunner.DecayForwards;
                    this.curve.byBend(setting.decayFrames, 1.0, setting.decayBend, setting.sustainValue);
                    this.remaining = setting.decayFrames;
                } else {
                    this.state = AdsrEnvelopeRunner.Sustain;
                    this.value = setting.sustainValue;
                    this.remaining = 0;
                }
                break;
            }
            case AdsrEnvelopeRunner.SustainInterpolation: {
                this.state = AdsrEnvelopeRunner.Sustain;
                this.value = setting.sustainValue;
                this.remaining = 0;
                break;
            }
            case AdsrEnvelopeRunner.Release:
            case AdsrEnvelopeRunner.Stop: {
                this.value = 0.0;
                this.state = AdsrEnvelopeRunner.Complete;
                break;
            }
        }
    }

    reTarget() {
        const setting = this.setting;
        switch (this.state) {
            case AdsrEnvelopeRunner.Sustain:
            case AdsrEnvelopeRunner.SustainInterpolation: {
                this.state = AdsrEnvelopeRunner.SustainInterpolation;
                this.curve.byBend(this.interpolation, this.value, 0.5, setting.sustainValue);
                this.remaining = this.interpolation;
                break;
            }
        }
    }

    running() {
        return this.state !== AdsrEnvelopeRunner.Complete;
    }
}

AdsrEnvelopeRunner.Attack = 1;
AdsrEnvelopeRunner.DecayForwards = 2;
AdsrEnvelopeRunner.DecayBackwards = 3;
AdsrEnvelopeRunner.Sustain = 4;
AdsrEnvelopeRunner.SustainInterpolation = 5;
AdsrEnvelopeRunner.Release = 6;
AdsrEnvelopeRunner.Stop = 7;
AdsrEnvelopeRunner.Complete = 8;
AdsrEnvelopeRunner.InterpolationMs = 0.005;