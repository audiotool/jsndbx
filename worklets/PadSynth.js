import {AbstractPolyphonicSynth} from "./AbstractPolyphonicSynth.js";
import {AdsrEnvelopeFormat} from "../modules/envelope.js";
import {ParameterBuilder} from "../modules/parameter.js";
import {
    Linear,
    LinearInt,
    Exp,
    NoFloat,
    OneFloat,
    Level,
    BipolarPercent,
    Cents
} from "../modules/mapping.js";
import {LFOFormat} from "../modules/lfo.js";

export class Harmonic {
    /**
     * @param position Usually integer values starting from 1
     * @param level multiplier [0,1]
     * @param bandWidth normalised band-width
     */
    constructor(position, level, bandWidth) {
        this.position = position;
        this.level = level;
        this.bandWidth = bandWidth;
        this.active = true;
    }
}

export class PadSynthSound {
    constructor(name, onChange) {
        this.name = name;
        this.onChange = onChange;
        this.oppressNotify = false;
        const onParameterChanged = ignore => {
            if (this.oppressNotify) {
                return;
            }
            this.generateHarmonics();
            onChange(this);
        };
        this.parameters = [];
        this.bandWidth = this.addParameter(ParameterBuilder.begin("Dispersion")
            .valueMapping(new Exp(5.0, 120.0))
            .value(60.0)
            .callback(onParameterChanged)
            .create());

        this.bandWidthScale = this.addParameter(ParameterBuilder.begin("Vaporisation")
            .valueMapping(new Linear(1.0, 2.0))
            .value(1.2)
            .callback(onParameterChanged)
            .create());

        this.metal = this.addParameter(ParameterBuilder.begin("Metal")
            .valueMapping(new Linear(0.0, 1.0))
            .value(0.0)
            .callback(onParameterChanged)
            .create());

        this.brightness = this.addParameter(ParameterBuilder.begin("Brightness")
            .valueMapping(new Linear(-3.0, 3.0))
            .printMapping(BipolarPercent)
            .anchor(0.5)
            .value(0.0)
            .callback(onParameterChanged)
            .create());

        this.distance = this.addParameter(ParameterBuilder.begin("Separation")
            .valueMapping(new LinearInt(1, 4))
            .printMapping(NoFloat)
            .unit("#")
            .value(1)
            .callback(onParameterChanged)
            .create());

        this.numHarmonics = this.addParameter(ParameterBuilder.begin("# Harmonics")
            .valueMapping(new LinearInt(1, PadSynthSound.NUM_HARMONICS))
            .printMapping(NoFloat)
            .unit("#")
            .value(PadSynthSound.NUM_HARMONICS)
            .callback(onParameterChanged)
            .create());

        this.notchAmount = this.addParameter(ParameterBuilder.begin("Comb Amount")
            .valueMapping(Linear.Identity)
            .value(0.0)
            .callback(onParameterChanged)
            .create());

        this.notchFrequency = this.addParameter(ParameterBuilder.begin("Comb Freq")
            .valueMapping(new Linear(1.0 / 32.0, 0.25))
            .value(1.0 / 16.0)
            .callback(onParameterChanged)
            .create());

        this.notchWidth = this.addParameter(ParameterBuilder.begin("Comb Width")
            .valueMapping(new LinearInt(1, 32))
            .printMapping(NoFloat)
            .unit("#")
            .value(4)
            .callback(onParameterChanged)
            .create());

        this.harmonics = this.initHarmonics();
        this.version = 0 | 0;
        this.generateHarmonics();
    }

    addParameter(parameter) {
        this.parameters.push(parameter);
        return parameter;
    }

    reset() {
        this.oppressNotify = true;
        for (let p of this.parameters) {
            p.reset();
        }
        this.forceNotify();
    }

    randomize() {
        this.oppressNotify = true;
        this.bandWidth.unipolar = Math.random() * Math.random();
        this.bandWidthScale.unipolar = Math.random() * Math.random();
        this.metal.unipolar = 0.5 < Math.random() ? Math.random() : 0.0;
        this.brightness.unipolar = 0.75 + (Math.random() - Math.random()) * 0.25;
        this.distance.unipolar = Math.random();
        this.numHarmonics.unipolar = 0.75 < Math.random() ? Math.random() : 1.0;
        this.notchAmount.unipolar = Math.random();
        this.notchFrequency.unipolar = Math.random();
        this.notchWidth.unipolar = Math.random();
        this.forceNotify();
    }

    copyTo(target) {
        this.oppressNotify = true;
        const source = this.parameters;
        for (let i = 0; i < source.length; i++) {
            target.parameters[i].value = source[i].value;
        }
        this.forceNotify();
    }

    initHarmonics() {
        const harmonics = new Array(PadSynthSound.NUM_HARMONICS);
        for (let i = 0; i < PadSynthSound.NUM_HARMONICS; i++) {
            harmonics[i] = new Harmonic(1.0, 0.0, 0.0);
        }
        return harmonics;
    }

    generateHarmonics() {
        const bandWidth = this.bandWidth.value;
        const bandWidthScale = this.bandWidthScale.value;
        const brightness = -Math.pow(2.0, -this.brightness.value);
        const metal = this.metal.value;
        const distance = this.distance.value;
        const numHarmonics = this.numHarmonics.value;
        const notchAmount = this.notchAmount.value;
        const notchFrequency = this.notchFrequency.value;
        const notchWidth = this.notchWidth.value;
        let i = 0;
        for (; i < numHarmonics; i++) {
            const position = i * distance + 1;
            const level = Math.pow(position, brightness);
            const bw = (Math.pow(2.0, bandWidth / 1200.0) - 1.0) * Math.pow(position, bandWidthScale);
            const metalOffset = (Math.sin(i) * metal * i) * (8.0 / numHarmonics);
            const notchLevel = notchAmount * Math.pow(Math.cos(i * notchFrequency * Math.PI), notchWidth * 2) + (1.0 - notchAmount);

            const harmonic = this.harmonics[i];
            harmonic.position = position + metalOffset;
            harmonic.level = level * notchLevel;
            harmonic.bandWidth = bw;
            harmonic.active = true;
        }
        for (; i < PadSynthSound.NUM_HARMONICS; i++) {
            const harmonic = this.harmonics[i];
            harmonic.level = 0.0;
            harmonic.bandWidth = 0.1;
            harmonic.active = false;
        }
        this.version++;
    }

    forceNotify() {
        this.oppressNotify = false;
        this.generateHarmonics();
        this.onChange(this);
    }
}

PadSynthSound.NUM_HARMONICS = 32;

export class PadSynthPreset {
    constructor(port) {
        this.masterVolume = ParameterBuilder.begin("Volume")
            .valueMapping(Level.DEFAULT)
            .value(-6.0)
            .printMapping(OneFloat)
            .unit("db")
            .createShared(port, "masterVolume");

        this.blendAB = ParameterBuilder.begin("Mix AB")
            .valueMapping(Linear.Identity)
            .value(0.0)
            .createShared(port, "blendAB");

        this.tuneA = ParameterBuilder.begin("Tune A")
            .unit("Cs")
            .valueMapping(Linear.Bipolar)
            .printMapping(Cents)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "tuneA");

        this.tuneB = ParameterBuilder.begin("Tune B")
            .unit("Cs")
            .valueMapping(Linear.Bipolar)
            .printMapping(Cents)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "tuneB");

        this.tune = ParameterBuilder.begin("Tune")
            .unit("Cs")
            .valueMapping(Linear.Bipolar)
            .printMapping(Cents)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "tune");

        this.stereo = ParameterBuilder.begin("Stereo")
            .valueMapping(Linear.Identity)
            .printMapping(BipolarPercent)
            .anchor(0.5)
            .value(0.5)
            .createShared(port, "stereo");

        this.lfoToBlend = ParameterBuilder.begin("Lfo→MixAB")
            .valueMapping(Linear.Bipolar)
            .printMapping(BipolarPercent)
            .value(0.0)
            .anchor(0.5)
            .createShared(port, "lfoToBlend");

        this.lfoToVolume = ParameterBuilder.begin("Lfo→Volume")
            .valueMapping(Linear.Bipolar)
            .printMapping(BipolarPercent)
            .value(0.0)
            .anchor(0.5)
            .createShared(port, "lfoToVolume");

        this.lfoToPitch = ParameterBuilder.begin("Lfo→Pitch")
            .unit("Cs")
            .valueMapping(Linear.Bipolar)
            .printMapping(Cents)
            .value(0.0)
            .anchor(0.5)
            .createShared(port, "lfoToPitch");

        this.lfoPanAmount = ParameterBuilder.begin("Lfo→Pan")
            .valueMapping(Linear.Bipolar)
            .printMapping(BipolarPercent)
            .value(0.0)
            .anchor(0.5)
            .createShared(port, "lfoPanAmount");

        this.envBToBlend = ParameterBuilder.begin("Env→MixAB")
            .valueMapping(Linear.Identity)
            .value(0.0)
            .createShared(port, "envBToBlend");

        this.envBToPitch = ParameterBuilder.begin("Env→Pitch")
            .unit("Cs")
            .valueMapping(Linear.Bipolar)
            .printMapping(Cents)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "envBToPitch");

        this.envBToLfoRate = ParameterBuilder.begin("Env→Rate")
            .valueMapping(Linear.Bipolar)
            .printMapping(BipolarPercent)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "envBToLfoRate");

        this.envBToLfoAmount = ParameterBuilder.begin("Env→Amount")
            .valueMapping(Linear.Bipolar)
            .printMapping(BipolarPercent)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "envBToLfoAmount");

        this.velocityToVolume = ParameterBuilder.begin("Vel→Vol")
            .value(1.0)
            .createShared(port, "velocityToVolume");

        this.velocityToBlend = ParameterBuilder.begin("Vel→MixAB")
            .value(0.0)
            .createShared(port, "velocityToBlend");

        this.keyboardToBlend = ParameterBuilder.begin("KT→MixAB")
            .valueMapping(Linear.Bipolar)
            .printMapping(BipolarPercent)
            .anchor(0.5)
            .value(0.0)
            .createShared(port, "keyboardToBlend");
    }
}

export class PadSynth extends AbstractPolyphonicSynth {
    constructor(context, worker) {
        super(context, "PadSynthProcessor");

        this.worker = worker;
        this.computation = null;
        this.waiting = false;
        this.soundA = new PadSynthSound("A", sound => this.updateSound(sound, "soundA"));
        this.soundB = new PadSynthSound("B", sound => this.updateSound(sound, "soundB"));
        this.updateSound(this.soundA, "soundA");
        this.updateSound(this.soundB, "soundB");
        this.presetFormat = new PadSynthPreset(this.port);
        this.envFormatA = new AdsrEnvelopeFormat(context.sampleRate, setting => this.postMessage("envSettingA", setting));
        this.envFormatA.sustainValue.value = 1.0;
        this.envFormatB = new AdsrEnvelopeFormat(context.sampleRate, setting => this.postMessage("envSettingB", setting));
        this.envFormatB.attackTime.value = 1000.0;
        this.envFormatB.attackBend.value = 0.5;
        this.envFormatB.sustainValue.value = 1.0;
        this.envFormatB.releaseEnabled.value = false;
        this.lfoFormat = new LFOFormat(context.sampleRate, setting => this.postMessage("lfoSetting", setting));
        this.postMessage("init", {numFrames: worker.fftSize, frequencies: worker.frequencies});
    }

    switchSounds() {
        this.soundA.oppressNotify = true;
        this.soundB.oppressNotify = true;
        const parametersA = this.soundA.parameters;
        const parametersB = this.soundB.parameters;
        const numParameters = parametersA.length;
        let tmp = 0.0;
        for (let i = 0; i < numParameters; i++) {
            tmp = parametersA[i].unipolar;
            parametersA[i].unipolar = parametersB[i].unipolar;
            parametersB[i].unipolar = tmp;
        }
        this.soundA.forceNotify();
        this.soundB.forceNotify();
    }

    updateSound(sound, action) {
        if (this.waiting) {
            return;
        }
        if (null !== this.computation) {
            this.computation.then(_ => this.updateSound(sound, action));
            this.waiting = true;
            return;
        }
        // const now = performance.now();
        this.computation = this.worker.update(sound.harmonics)
            .then(tables => {
                // console.log(action, "tables computed in", performance.now() - now, "ms");
                this.postMessage(action, tables);
                this.computation = null;
                this.waiting = false;
            });
    }

    postMessage(action, value) {
        this.port.postMessage({
            action: action,
            value: value
        });
    }
}

export class PadWorker {
    constructor(Q, sampleRate, favoredLowestFrequency) {
        this.fftSize = 1 << Q;
        this.sampleRate = sampleRate;
        this.bin = this.sampleRate / this.fftSize;
        this.lowestFrequency = Math.ceil(favoredLowestFrequency / this.bin) * this.bin;
        this.nyquist = sampleRate * 0.5;
        this.numTables = 1 + Math.floor((Math.log2(this.nyquist / this.lowestFrequency))) | 0;
        this.frequencies = new Float64Array(this.numTables);
        for (let index = 0; index < this.numTables; index++) {
            this.frequencies[index] = this.lowestFrequency * Math.pow(2.0, index);
        }
        this.worker = new Worker("./workers/pad.js");
        this.worker.postMessage({
            action: "init",
            value: {fftSize: this.fftSize, sampleRate: this.sampleRate, frequencies: this.frequencies}
        });
        this.tasks = [];
        this.worker.onerror = event => {
            console.log(event);
        };
        this.worker.onmessage = event => {
            if (0 < this.tasks.length) {
                this.tasks.shift()(event.data);
            } else {
                throw new Error("Got message, but nothing was requested.");
            }
        };
    }

    update(harmonics) {
        return new Promise((resolve, ignore) => {
            this.tasks.push(resolve);
            this.worker.postMessage({
                action: "update",
                value: harmonics
            });
        });
    }
}