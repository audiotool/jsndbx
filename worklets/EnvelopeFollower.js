export class EnvelopeFollower extends AudioWorkletNode {
    constructor(context) {
        super(context, "envelope-follower", {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 2,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });

        this.$attack = NaN;
        this.$release = NaN;
        this.attack = 0.010;
        this.release = 0.030;
    }

    set attack(seconds) {
        if (this.$attack === seconds) {
            return;
        }
        this.port.postMessage({action: "attack", value: seconds});
        this.$attack = seconds;
    }

    get attack() {
        return this.$attack;
    }

    set release(seconds) {
        if (this.$release === seconds) {
            return;
        }
        this.port.postMessage({action: "release", value: seconds});
        this.$release = seconds;
    }

    get release() {
        return this.$release;
    }
}