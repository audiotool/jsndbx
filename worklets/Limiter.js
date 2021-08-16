export class Limiter extends AudioWorkletNode {
    constructor(context) {
        super(context, "limiter", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });

        this.$lookahead = NaN;
        this.$threshold = NaN;

        this.lookahead = 0.005;
        this.threshold = 0.0;
    }

    set lookahead(seconds) {
        if( this.$lookahead === seconds ) {
            return;
        }
        this.port.postMessage({action: "lookahead", value: seconds});
        this.$lookahead = seconds;
    }

    get lookahead() {
        return this.$lookahead;
    }

    set threshold(db) {
        if( this.$threshold === db ) {
            return;
        }
        this.port.postMessage({action: "threshold", value: db});
        this.$threshold = db;
    }

    get threshold() {
        return this.$threshold;
    }
}