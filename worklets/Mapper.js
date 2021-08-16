export class Mapper extends AudioWorkletNode {
    constructor(context) {
        super(context, "mapper", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });
    }

    mapping(func) {
        this.port.postMessage(func.toString());
    }
}