import {AbstractAudioWorkletProcessor} from "./AbstractAudioWorkletProcessor.js";
import {RenderQuantum, dbToGain} from "../modules/neutrons.js";

registerProcessor("click", class extends AbstractAudioWorkletProcessor {
    constructor(options) {
        super(options);

        this.position = 0.0;
        this.phase = 0.0;
        this.phaseIncr = 12000.0 / sampleRate;
        this.incrCoeff = Math.exp(-1.0 / (0.000001 * sampleRate));

        this.pLevel = this.bindParameter("level");
        this.pTune = this.bindParameter("tune");
    }

    restart() {
        this.position = 0.0;
        this.phase = 0.0;
        this.phaseIncr = 12000.0 / sampleRate;
    }

    process(inputs, outputs, ignore) {
        const channel = outputs[0][0];

        const level = dbToGain(this.pLevel.value);
        const cycles = this.pTune.value;
        for (let i = 0; i < RenderQuantum; i++) {
            let attack;
            if (this.position < cycles) {
                let x = Math.sin(this.position * Math.PI / cycles);
                x *= x;
                x *= x;
                attack = Math.sin(this.phase * 2.0 * Math.PI) * x;
            } else {
                attack = 0.0;
            }
            const attackTarget = 1.0 / sampleRate;
            this.phase += this.phaseIncr;
            this.phaseIncr = attackTarget + this.incrCoeff * (this.phaseIncr - attackTarget);
            this.position += 1.0 / sampleRate;
            channel[i] += attack * level;
        }
        return true;
    }
});