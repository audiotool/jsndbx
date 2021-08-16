import {AbstractAudioWorkletProcessor} from "./AbstractAudioWorkletProcessor.js";

export class AbstractPolyphonicSynthProcessor extends AbstractAudioWorkletProcessor {
    constructor(options) {
        super(options);

        this.voices = [];
        this.voiceMap = {};
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const voices = this.voices;
        let index = voices.length;
        while (--index >= 0) {
            if (!voices[index].process(output)) {
                voices.splice(index, 1);
            }
        }
        return true;
    }

    isPlaying() {
        return 0 < this.voices.length;
    }

    createVoice(note, velocity) {
        throw new Error("abstract");
    }

    processMessage(data) {
        const action = data.action;
        const value = data.value;
        switch (action) {
            case "noteOn":
                const note = value.note;
                const voice = this.createVoice(note, value.velocity);
                if (null === voice) {
                    return true;
                }
                this.voices.push(voice);
                if (undefined === this.voiceMap[note]) {
                    this.voiceMap[note] = [voice];
                } else {
                    this.voiceMap[note].push(voice);
                }
                return true;
            case "noteOff": {
                const activeVoices = this.voiceMap[value.note];
                if (undefined === activeVoices) {
                    console.warn("Note off without Note on.");
                    return true;
                }
                const voice = activeVoices.pop();
                if (undefined === voice) {
                    console.warn("Note off without Note on.");
                    return true;
                }
                voice.release();
                return true;
            }
        }
        return false;
    }
}