export class AbstractPolyphonicSynth extends AudioWorkletNode {
    constructor(context) {
        super(context, "PadSynthProcessor", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });
    }

    noteOn(note, velocity) {
        this.port.postMessage({action: "noteOn", value: {note: note, velocity: velocity}});
    }

    noteOff(note) {
        this.port.postMessage({action: "noteOff", value: {note: note}});
    }
}