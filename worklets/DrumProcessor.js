import {Biquad} from "../modules/biquad.js";
import {AbstractAudioWorkletProcessor} from "./AbstractAudioWorkletProcessor.js";
import {barsToNumFrames, dbToGain, envCoeff, numFramesToBars, RenderQuantum, tri} from "../modules/neutrons.js";

registerProcessor("drums", class extends AbstractAudioWorkletProcessor {
    constructor(options) {
        super(options);

        this.channels = [
            new Kick(this, sampleRate),
            new Clap(this, sampleRate),
            new Cowbell(this, sampleRate)
        ];

        this.bpm = 120.0;
        this.bar = 0.0;

        this.pattern = null;
        this.noise = null;
    }

    process(inputs, outputs, ignore) {
        if (this.pattern === null) {
            return true;
        }
        const buffer = outputs[0][0];

        const b0 = this.bar;
        const b1 = b0 + numFramesToBars(RenderQuantum, this.bpm, sampleRate);
        const scale = 1.0 / 16.0;
        const numChannels = this.channels.length;

        let from = 0 | 0;
        let to = RenderQuantum;
        let index = (b0 / scale) | 0;
        let position = index * scale;
        while (position < b1) {
            if (position >= b0) {
                const stepIndex = index % 16;
                let hasTrigger = false;
                for (let i = 0; i < numChannels; i++) {
                    const channel = this.pattern[i];
                    if (channel[stepIndex]) {
                        hasTrigger = true;
                        break;
                    }
                }
                if (hasTrigger) {
                    const frame = barsToNumFrames(position - b0, this.bpm, sampleRate) | 0;
                    if (frame > from) {
                        this.render(buffer, from, frame);
                        from = frame;
                    }
                    for (let i = 0; i < numChannels; i++) {
                        const channel = this.pattern[i];
                        if (channel[stepIndex]) {
                            this.channels[i].restart();
                        }
                    }
                }
            }
            position = ++index * scale;
        }
        if (to > from) {
            this.render(buffer, from, to);
        }
        this.bar = b1;
        return true;
    }

    processMessage(data) {
        if (super.processMessage(data)) {
            return;
        }
        if (data.action === "pattern") {
            this.pattern = data.value;
        }
        if (data.action === "noise") {
            this.noise = data.value;
        }
        return true;
    }

    render(buffer, from, to) {
        for (let i = 0; i < this.channels.length; i++) {
            this.channels[i].render(buffer, from, to);
        }
    }
});

class Kick {
    constructor(processor, sampleRate) {
        this.sampleRate = sampleRate;

        this.volume = processor.bindParameter("kick/volume");
        this.pitchFloor = processor.bindParameter("kick/pitchFloor");
        this.pitchBend = processor.bindParameter("kick/pitchBend");
        this.pitchTime = processor.bindParameter("kick/pitchTime");
        this.decayTime = processor.bindParameter("kick/decayTime");
        this.attackLevel = processor.bindParameter("kick/attackLevel");

        this.phase = 0.0;
        this.envCoeff = Math.exp(-1.0 / (0.002 * sampleRate));

        this.position = 0.0;
        this.attackLength = 0.005;
        this.env = 0.0;
        this.attachPhase = 0.0;
        this.attachPhaseIncr = 0.0;
        this.running = false;
    }

    render(buffer, from, to) {
        if (!this.running) {
            return;
        }
        const attackLevel = this.attackLevel.value;
        const decayTime = this.decayTime.value;
        const gain = dbToGain(this.volume.value);
        let env;
        for (let i = from; i < to; ++i) {
            if (this.position < this.attackLength) {
                env = 1.0;
            } else {
                const x = (this.position - this.attackLength) / decayTime;
                if (x < 1.0) {
                    const y = 1.0 - x;
                    env = y * y * y;
                } else {
                    env = 0.0;
                }
            }

            let attack;
            const cycles = 0.0003;
            if (this.position < cycles) {
                let x = Math.sin(this.position * Math.PI / cycles);
                x *= x;
                x *= x;
                attack = Math.sin(this.attachPhase * 2.0 * Math.PI) * x;
            } else {
                attack = 0.0;
            }
            const attackTarget = 1.0 / sampleRate;
            this.attachPhase += this.attachPhaseIncr;
            this.attachPhaseIncr = attackTarget + this.attachIncrCoeff * (this.attachPhaseIncr - attackTarget);

            this.env = env + this.envCoeff * (this.env - env);

            const out = this.shape(this.phase) * this.env;
            this.phase += this.phaseIncr;
            this.phase -= Math.floor(this.phase);
            this.phaseIncr = this.phaseIncrMin + this.phaseIncrCoeff * (this.phaseIncr - this.phaseIncrMin);
            this.position += 1.0 / sampleRate;
            buffer[i] += (out + attack * attackLevel) * gain;
        }
    }

    restart() {
        this.running = true;
        this.updatePitch();
        this.position = 0.0;
        this.phaseIncr = this.phaseIncrMax;
        this.attachPhase = 0.0;
        this.attachPhaseIncr = 12000 / sampleRate;
        this.attachIncrCoeff = Math.exp(-1.0 / (0.000001 * sampleRate));
    }

    updatePitch() {
        this.phaseIncrMin = this.pitchFloor.value / sampleRate;
        this.phaseIncrMax = this.pitchFloor.value * this.pitchBend.value / sampleRate;
        this.phaseIncrCoeff = Math.exp(-1.0 / (this.pitchTime.value * sampleRate));
    }

    shape(x) {
        if (x < 0.5) {
            return 1.0 - 4 * Math.pow(0.5 - 2.0 * x, 2.0);
        }
        return 4 * Math.pow(1.5 - 2.0 * x, 2.0) - 1.0;
    }
}

class Clap {
    constructor(processor, sampleRate) {
        this.processor = processor;
        this.sampleRate = sampleRate;

        this.volume = processor.bindParameter("clap/volume");
        this.decay = processor.bindParameter("clap/decay");
        this.offset = processor.bindParameter("clap/offset");

        this.frequency = processor.bindParameter("clap/frequency");
        this.bandwidth = processor.bindParameter("clap/bandwidth");
        this.separation = processor.bindParameter("clap/separation");

        this.env = 0.0;
        this.envCoeff = Math.exp(-1.0 / (0.001 * sampleRate));
        this.stage = -1;
        this.envPosition = 0;
        this.noisePosition = 0;

        this.band0 = new Biquad();
        this.band1 = new Biquad();
    }

    filterUpdate() {
        const separation = this.separation.value;
        Biquad.bandBand(this.band0, this.frequency.value * separation, sampleRate, this.bandwidth.value * separation);
        Biquad.bandBand(this.band1, this.frequency.value, sampleRate, this.bandwidth.value);
    }

    render(buffer, from, to) {
        if (-1 === this.stage) {
            return;
        }
        const noise = this.processor.noise;
        if (null === noise) {
            return;
        }
        this.filterUpdate();
        const gateLength = (this.offset.value * sampleRate) | 0;
        const mask = noise.length - 1;
        const gain = dbToGain(this.volume.value) * 2.0; // twice for filter makeup
        for (let i = from; i < to; i++) {
            let noiseAmp = noise[this.noisePosition];
            let env;
            if (this.stage < 2) {
                env = 1.0 - this.envPosition / gateLength;
                if (++this.envPosition >= gateLength) {
                    this.envPosition = 0;
                    this.stage++;
                }
            } else if (this.stage === 2) {
                env = 1.0 - this.envPosition / gateLength;
                if (++this.envPosition >= gateLength / 2) {
                    this.envCoeff = Math.exp(-1.0 / (this.decay.value * sampleRate));
                    this.stage = 3;
                }
            } else {
                env = 0.0;
            }
            this.env = env + this.envCoeff * (this.env - env);
            noiseAmp = this.band0.process(noiseAmp) * gain;
            noiseAmp = this.band1.process(noiseAmp) * gain;
            buffer[i] += noiseAmp * this.env;
            this.noisePosition = (this.noisePosition + 1) & mask;
        }
    }

    restart() {
        this.stage = 0;
        this.envPosition = 0;
        this.envCoeff = Math.exp(-1.0 / (0.001 * sampleRate));
    }
}

class Cowbell {
    constructor(processor, sampleRate) {
        this.processor = processor;
        this.sampleRate = sampleRate;

        this.volume = processor.bindParameter("cowbell/volume");
        this.decay = processor.bindParameter("cowbell/decay");
        this.frequency = processor.bindParameter("cowbell/frequency");

        this.env = 0.0;
        this.envCoeff = envCoeff(2.0, sampleRate);
        this.envPosition = -1 | 0;
        this.phase = 0.0;

        this.band = new Biquad();
    }

    filterUpdate() {
        Biquad.highPass(this.band, this.frequency.value * 2.0, sampleRate, 1.0);
    }

    render(buffer, from, to) {
        if (-1 === this.envPosition) {
            return;
        }
        this.filterUpdate();
        const attack = (0.002 * this.sampleRate) | 0;
        const decay = (0.006 * this.sampleRate + attack) | 0;
        const gain = dbToGain(this.volume.value) * 2.0; // makeup gain
        const phaseIncr = this.frequency.value / this.sampleRate;
        for (let i = from; i < to; i++) {
            const low = tri(this.phase, 0.01);
            const high = tri(this.phase * 1.476702509, 0.01);
            let env;
            if (this.envPosition < attack) {
                env = 1.0;
            } else if (this.envPosition < decay) {
                env = 0.1;
            } else if (this.envPosition === decay) {
                this.envCoeff = envCoeff(this.decay.value, this.sampleRate);
                env = this.env;
            } else {
                env = 0.0;
            }
            this.env = env + this.envCoeff * (this.env - env);
            this.phase += phaseIncr;
            this.envPosition++;
            buffer[i] += this.band.process(low + high) * gain * this.env;
        }
    }

    restart() {
        this.envPosition = 0.0;
        this.envCoeff = envCoeff(2.0, this.sampleRate);
    }
}