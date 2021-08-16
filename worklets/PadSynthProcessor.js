import {AbstractPolyphonicSynthProcessor} from "./AbstractPolyphonicSynthProcessor.js";
import {RenderQuantum, midiToFrequency, hermite, dbToGain, biToUnipolar} from "../modules/neutrons.js";
import {AdsrEnvelopeSetting, AdsrEnvelopeRunner} from "../modules/envelope.js";
import {LFORunner, LFOSetting} from "../modules/lfo.js";
import {clamp} from "../modules/standard.js";

class TableReader {
    static process(scope, output, tables, freqMod, freqMult, phase) {
        const maskFrames = scope.maskFrames;
        const maxTableIndex = scope.numTables - 1;
        const freqInverse = scope.freqInverse;
        const sampleRateInverse = 1.0 / sampleRate;
        for (let i = 0; i < RenderQuantum; i++) {
            const frequency = freqMod[i] * freqMult;
            const index0 = scope.computeIndex(frequency);
            if (index0 > maxTableIndex) {
                output[i] = 0.0;
                continue;
            }
            const indexInt0 = index0 | 0;
            const indexInt1 = indexInt0 + 1;
            const gain1 = index0 - indexInt0;
            const gain0 = 1.0 - gain1;
            const rate0 = freqInverse[indexInt0];
            const a = hermite(tables[indexInt0], phase * rate0, maskFrames);
            if (indexInt1 >= maxTableIndex) {
                output[i] = a * gain0;
            } else {
                const rate1 = freqInverse[indexInt1];
                const b = hermite(tables[indexInt1], phase * rate1, maskFrames);
                output[i] = a * gain0 + b * gain1;
            }
            phase += frequency * sampleRateInverse;
        }
        return phase;
    }
}

class PadSynthVoice {
    constructor(scope, sampleRate, time, note, velocity) {
        this.scope = scope;

        const numFrames = scope.numFrames;
        const phase = Math.random() * numFrames;
        const stereo = scope.stereo.value;
        const phaseShift = stereo <= 0.5 ? stereo * numFrames * 0.5 : 0.0;

        this.frequencyShift = stereo > 0.5 ? Math.pow(2.0, (stereo - 0.5) * 2.0) : 1.0;
        this.frequency = midiToFrequency(note, 440.0);

        this.phases = new Float64Array(4);
        this.freqMultiplier = new Float64Array(4);
        this.phases[0] = this.phases[2] = phase;
        this.phases[1] = this.phases[3] = phase + phaseShift;

        this.envRunnerA = new AdsrEnvelopeRunner(scope.envSettingA, sampleRate);
        this.envRunnerB = new AdsrEnvelopeRunner(scope.envSettingB, sampleRate);
        this.lfoRunner = new LFORunner(scope.lfoSetting, sampleRate);
        this.lfoRunner.setTime(time);

        const velocityToVolume = scope.velocityToVolume.value;
        this.gain = (velocityToVolume * velocity + (1.0 - velocityToVolume)) * dbToGain(scope.masterVolume.value);
        this.velocity = velocity;
        this.trackingAmount = clamp(-1.0, 1.0, (note - 60.0) / 36.0) * scope.keyboardToBlend.value;
    }

    release() {
        this.envRunnerA.releaseGate();
        this.envRunnerB.releaseGate();
    }

    process(output) {
        const scope = this.scope;
        const outputL = output[0];
        const outputR = output[1];
        const currentTables = scope.currentTables;
        const envBufferA = PadSynthVoice.EnvBuffers[0];
        const envBufferB = PadSynthVoice.EnvBuffers[1];
        const lfoBuffer = PadSynthVoice.LfoBuffer;
        const tableBuffers = PadSynthVoice.TableBuffers;
        const tableBufferL0 = PadSynthVoice.TableBuffers[0];
        const tableBufferR0 = PadSynthVoice.TableBuffers[1];
        const tableBufferL1 = PadSynthVoice.TableBuffers[2];
        const tableBufferR1 = PadSynthVoice.TableBuffers[3];
        const freqMod = PadSynthVoice.FrequencyModulation;

        const baseMixAB = scope.blendAB.value;
        const lfoToMixABAmount = scope.lfoToBlend.value;
        const lfoToVolumeAmount = scope.lfoToVolume.value;
        const lfoToPitchAmount = scope.lfoToPitch.value;
        const envBToBlendAmount = scope.envBToBlend.value;
        const envBToPitchAmount = scope.envBToPitch.value;
        const envBToLfoRate = scope.envBToLfoRate.value;
        const envBToLfoAmount = scope.envBToLfoAmount.value;
        const velocityAmount = this.velocity * scope.velocityToBlend.value;

        this.envRunnerA.process(envBufferA, RenderQuantum, 0);
        this.envRunnerB.process(envBufferB, RenderQuantum, 0);
        this.lfoRunner.process(lfoBuffer, envBufferB, envBToLfoRate);

        if (0.0 <= envBToLfoAmount) {
            for (let i = 0; i < RenderQuantum; i++) {
                lfoBuffer[i] *= (envBufferB[i] * envBToLfoAmount + (1.0 - envBToLfoAmount));
            }
        } else {
            for (let i = 0; i < RenderQuantum; i++) {
                lfoBuffer[i] *= ((envBufferB[i] - 1.0) * envBToLfoAmount + (1.0 + envBToLfoAmount));
            }
        }

        for (let i = 0; i < RenderQuantum; i++) {
            const lfoValue = lfoBuffer[i];
            const pitchMultiplier = Math.pow(2.0, lfoToPitchAmount * lfoValue + envBToPitchAmount * envBufferB[i]);
            freqMod[i] = this.frequency * pitchMultiplier;
        }
        const phases = this.phases;
        const freqMultiplier = this.freqMultiplier;
        const tune = scope.tune.value;
        const tuneA = Math.pow(2.0, scope.tuneA.value + tune);
        const tuneB = Math.pow(2.0, scope.tuneB.value + tune);
        freqMultiplier[0] = tuneA * this.frequencyShift;
        freqMultiplier[1] = tuneA / this.frequencyShift;
        freqMultiplier[2] = tuneB * this.frequencyShift;
        freqMultiplier[3] = tuneB / this.frequencyShift;

        for (let s = 0; s < 2; s++) {
            const i0 = s << 1;
            const i1 = i0 + 1;
            const tableBuffer0 = tableBuffers[i0];
            const tableBuffer1 = tableBuffers[i1];
            if (null === scope.waitingTables[s]) {
                phases[i0] = TableReader.process(scope, tableBuffer0, currentTables[s], freqMod, freqMultiplier[i0], phases[i0]);
                phases[i1] = TableReader.process(scope, tableBuffer1, currentTables[s], freqMod, freqMultiplier[i1], phases[i1]);
            } else {
                const waitingTables = scope.waitingTables;
                const crossFadeBuffers = PadSynthVoice.CrossFadeBuffers;
                const crossFadeBuffer0 = crossFadeBuffers[0];
                const crossFadeBuffer1 = crossFadeBuffers[1];
                TableReader.process(scope, tableBuffer0, currentTables[s], freqMod, freqMultiplier[i0], phases[i0]);
                TableReader.process(scope, tableBuffer1, currentTables[s], freqMod, freqMultiplier[i1], phases[i1]);
                phases[i0] = TableReader.process(scope, crossFadeBuffer0, waitingTables[s], freqMod, freqMultiplier[i0], phases[i0]);
                phases[i1] = TableReader.process(scope, crossFadeBuffer1, waitingTables[s], freqMod, freqMultiplier[i1], phases[i1]);
                const delta = 1.0 / RenderQuantum;
                let alpha = 0.0;
                for (let i = 0; i < RenderQuantum; i++) {
                    tableBuffer0[i] = tableBuffer0[i] * (1.0 - alpha) + crossFadeBuffer0[i] * alpha;
                    tableBuffer1[i] = tableBuffer1[i] * (1.0 - alpha) + crossFadeBuffer1[i] * alpha;
                    alpha += delta;
                }
            }
        }

        const crossPan = scope.lfoPanAmount.value;

        for (let i = 0; i < RenderQuantum; ++i) {
            const lfoValue = lfoBuffer[i];
            const gainMod = 0 <= lfoToVolumeAmount ?
                (lfoValue + 1.0) * 0.5 * lfoToVolumeAmount + (1.0 - lfoToVolumeAmount) :
                (lfoValue - 1.0) * 0.5 * lfoToVolumeAmount + (1.0 + lfoToVolumeAmount);
            const envAValue = envBufferA[i];
            const envBValue = envBufferB[i];
            const gain = envAValue * this.gain * gainMod;
            const lfoToMixAB = lfoValue * lfoToMixABAmount;
            let mixAB = baseMixAB + (lfoToMixAB < 0.0 ? lfoToMixAB * baseMixAB : lfoToMixAB * (1.0 - baseMixAB));
            mixAB += envBValue * envBToBlendAmount * (1.0 - mixAB);
            mixAB += velocityAmount * (1.0 - mixAB);
            mixAB = clamp(0.0, 1.0, mixAB + this.trackingAmount);
            const gain1 = mixAB;
            const gain0 = 1.0 - gain1;
            const l0 = tableBufferL0[i] * gain0;
            const r0 = tableBufferR0[i] * gain0;
            const l1 = tableBufferL1[i] * gain1;
            const r1 = tableBufferR1[i] * gain1;

            const x = crossPan * lfoValue;
            const a = x <= 0.0 ? 1.0 : 1.0 - x * x;
            const b = x <= 0.0 ? 0.0 : x * x;
            const c = x <= 0.0 ? x * x : 0.0;
            const d = x <= 0.0 ? 1.0 - x * x : 1.0;

            const outL = l0 * a + r0 * c + l1 * d + r1 * b;
            const outR = l0 * b + r0 * d + l1 * c + r1 * a;
            outputL[i] += outL * gain;
            outputR[i] += outR * gain;
        }
        return this.envRunnerA.running();
    }
}

// We are single threaded here. Let's save some memory
//
PadSynthVoice.LfoBuffer = new Float32Array(RenderQuantum);
PadSynthVoice.FrequencyModulation = new Float32Array(RenderQuantum);
PadSynthVoice.EnvBuffers = [
    new Float32Array(RenderQuantum),
    new Float32Array(RenderQuantum)
];
PadSynthVoice.TableBuffers = [
    new Float32Array(RenderQuantum),
    new Float32Array(RenderQuantum),
    new Float32Array(RenderQuantum),
    new Float32Array(RenderQuantum)
];
PadSynthVoice.CrossFadeBuffers = [
    new Float32Array(RenderQuantum),
    new Float32Array(RenderQuantum)
];

registerProcessor("PadSynthProcessor", class extends AbstractPolyphonicSynthProcessor {
    constructor(options) {
        super(options);

        this.numFrames = 0 | 0;
        this.maskFrames = 0 | 0;
        this.lowestFrequency = NaN;
        this.frequencies = null;
        this.freqInverse = null;
        this.numTables = 0;
        this.currentTables = [null, null];
        this.waitingTables = [null, null];
        this.envSettingA = new AdsrEnvelopeSetting();
        this.envSettingB = new AdsrEnvelopeSetting();
        this.lfoSetting = new LFOSetting();
        this.stereo = this.bindParameter("stereo");
        this.blendAB = this.bindParameter("blendAB");
        this.tune = this.bindParameter("tune");
        this.tuneA = this.bindParameter("tuneA");
        this.tuneB = this.bindParameter("tuneB");
        this.lfoToBlend = this.bindParameter("lfoToBlend");
        this.lfoToVolume = this.bindParameter("lfoToVolume");
        this.lfoToPitch = this.bindParameter("lfoToPitch");
        this.lfoPanAmount = this.bindParameter("lfoPanAmount");
        this.envBToBlend = this.bindParameter("envBToBlend");
        this.envBToPitch = this.bindParameter("envBToPitch");
        this.envBToLfoRate = this.bindParameter("envBToLfoRate");
        this.envBToLfoAmount = this.bindParameter("envBToLfoAmount");
        this.velocityToVolume = this.bindParameter("velocityToVolume");
        this.velocityToBlend = this.bindParameter("velocityToBlend");
        this.keyboardToBlend = this.bindParameter("keyboardToBlend");
        this.masterVolume = this.bindParameter("masterVolume");
    }

    computeIndex(frequency) {
        return Math.max(0.0, Math.log2(frequency / this.lowestFrequency) + 1.0);
    }

    processMessage(data) {
        if (super.processMessage(data)) {
            return;
        }
        const action = data.action;
        const value = data.value;
        // console.log(action, value);
        switch (action) {
            case "init": {
                this.numFrames = value.numFrames | 0;
                this.maskFrames = (this.numFrames - 1) | 0;
                this.frequencies = value.frequencies;
                this.lowestFrequency = this.frequencies[0];
                this.numTables = this.frequencies.length;
                this.freqInverse = new Float64Array(this.numTables);
                for (let i = 0; i < this.numTables; i++) {
                    this.freqInverse[i] = sampleRate / this.frequencies[i];
                }
                break;
            }
            case "envSettingA": {
                this.envSettingA.copyFrom(value);
                this.envSettingA.version++;
                break;
            }
            case "envSettingB": {
                this.envSettingB.copyFrom(value);
                this.envSettingA.version++;
                break;
            }
            case "lfoSetting": {
                this.lfoSetting.copyFrom(value);
                this.lfoSetting.version++;
                break;
            }
            case "soundA": {
                if (this.isPlaying()) {
                    this.waitingTables[0] = value;
                } else {
                    this.currentTables[0] = value;
                    this.waitingTables[0] = null;
                }
                break;
            }
            case "soundB": {
                if (this.isPlaying()) {
                    this.waitingTables[1] = value;
                } else {
                    this.currentTables[1] = value;
                    this.waitingTables[1] = null;
                }
                break;
            }
        }
    }

    process(inputs, outputs, parameters) {
        const processing = super.process(inputs, outputs, parameters);
        for (let i = 0; i < 2; i++) {
            if (null !== this.waitingTables[i]) {
                this.currentTables[i] = this.waitingTables[i];
                this.waitingTables[i] = null;
            }
        }
        return processing;
    }

    createVoice(note, velocity) {
        if (this.currentTables[0] === null || this.currentTables[1] === null) {
            return null;
        }
        return new PadSynthVoice(this, sampleRate, currentTime, note, velocity);
    }
});