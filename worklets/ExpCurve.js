export class ExpCurve extends AudioWorkletNode {
    constructor(context) {
        super(context, "ExpCurve", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });
    }

    mapping(value) {
        this.port.postMessage({action: "set-mapping", value: value.serialise()});
    }

    points(values) {
        this.port.postMessage({action: "set-points", value: values});
    }

    reset() {
        this.port.postMessage({action: "reset"});
    }
}