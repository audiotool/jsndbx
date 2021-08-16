export class Block extends AudioWorkletNode {
    constructor(context) {
        super(context, "block", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });
    }

    n(value) {
        this.port.postMessage(value);
    }
}