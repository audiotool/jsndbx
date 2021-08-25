import {PrintMapping, Value} from "../modules/value.js";

export class SampleType {
}

SampleType.Mono = 1; // A sample with only one (mono) channel.
SampleType.Right = 2; // A sample with two channels, where this sample is the right channel.
SampleType.Left = 4; // A sample with two channels, where this sample is the left channel.

export class Sample {
    constructor(context, data, name, numFrames, sampleRate, lowestKey, rootKey, rootFineTune, loopStart, loopEnd, loopEnabled) {
        this.context = context;
        this.data = data;
        this.name = new Value(name, PrintMapping.Any);
        this.numFrames = new Value(numFrames | 0, PrintMapping.PositiveInteger);
        this.sampleRate = new Value(sampleRate | 0, PrintMapping.PositiveInteger);
        this.lowestKey = new Value(lowestKey | 0, PrintMapping.MidiNote);
        this.rootKey = new Value(rootKey | 0, PrintMapping.MidiNote);
        this.rootFineTune = new Value(rootFineTune | 0, PrintMapping.LinearInt(0, 100));
        this.loopStart = new Value(loopStart | 0, PrintMapping.PositiveInteger);
        this.loopEnd = new Value(loopEnd | 0, PrintMapping.PositiveInteger);
        this.loopEnabled = new Value(loopEnabled | 0, PrintMapping.Boolean);

        this.numPlaying = new Value(0, PrintMapping.PositiveInteger);

        this.optBuffer = null;

        const invalidator = () => this.optBuffer = null;
        this.numFrames.addObserver(invalidator);
        this.sampleRate.addObserver(invalidator);
    }

    play(output, key) {
        const keyDifference = key - this.rootKey.value;
        const playbackRate = Math.pow(2.0, keyDifference / 12.0 + this.rootFineTune.value / 1200.0);
        const gain = this.context.createGain();
        const source = this.context.createBufferSource();
        const startTime = this.context.currentTime;
        gain.gain.value = 1.0;
        gain.gain.setValueAtTime(1.0, startTime);
        source.connect(gain);
        gain.connect(output);
        source.buffer = this.buffer;
        source.playbackRate.value = playbackRate;
        if (this.loopEnabled.value) {
            const sampleRate = this.sampleRate.value;
            source.loopStart = this.loopStart.value / sampleRate;
            source.loopEnd = this.loopEnd.value / sampleRate;
            source.loop = true;
        }
        source.onended = () => this.numPlaying.value--;
        source.start(startTime);
        this.numPlaying.value++;
        return () => {
            const currentTime = this.context.currentTime;
            const endTime = currentTime + 0.1;
            gain.gain.setValueAtTime(1.0, currentTime);
            gain.gain.linearRampToValueAtTime(0.0, endTime);
            source.stop(endTime);
        };
    }

    get buffer() {
        if (null === this.optBuffer) {
            const numChannels = this.data.length;
            console.assert(0 < numChannels && numChannels <= 2);
            this.optBuffer = this.context.createBuffer(numChannels, this.data[0].length, this.sampleRate.value);
            for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
                const shortArray = this.data[channelIndex];
                const floatArray = new Float32Array(this.numFrames.value);
                for (let frameIndex = 0; frameIndex < this.numFrames.value; frameIndex++) {
                    floatArray[frameIndex] = shortArray[frameIndex] / 0x7FFF;
                }
                this.optBuffer.copyToChannel(floatArray, channelIndex, 0);
            }
        }
        return this.optBuffer;
    }

    dispose() {
        this.name.dispose();
        this.numFrames.dispose();
        this.sampleRate.dispose();
        this.lowestKey.dispose();
        this.rootKey.dispose();
        this.rootFineTune.dispose();
        this.loopStart.dispose();
        this.loopEnd.dispose();
        this.loopEnabled.dispose();
        this.optBuffer = null;
    }
}

export class SampleBuilder {
    constructor(context, zone) {
        this.context = context;
        this.zone = zone;
        this.samples = [];
    }

    push(sample) {
        this.samples.push(sample);
    }

    type() {
        let type = 0;
        for (let sample of this.samples) {
            type |= sample.header.type;
        }
        return type;
    }

    make() {
        console.assert(this.samples.length > 0);
        const header = this.samples[0].header;
        const sampleRate = header.sampleRate;
        const rootKey = header.originalPitch;
        const rootFineTune = header.pitchCorrection;
        const lowestKey = this.zone.keyRange?.lo | 0;
        const loopStart = header.startLoop - header.start;
        const loopEnd = header.endLoop - header.start;
        const loopEnabled = this.zone.generators[54]?.amount === 1;
        const type = this.type();
        if (type === SampleType.Mono || type === SampleType.Left || type === SampleType.Right) {
            if (this.samples.length > 1) console.warn("Mono sample has more than one channel");
            const numFrames = header.end - header.start;
            return new Sample(this.context, [this.samples[0].data],
                header.name, numFrames, sampleRate, lowestKey, rootKey, rootFineTune, loopStart, loopEnd, loopEnabled);
        }
        if (type === (SampleType.Left | SampleType.Right)) {
            console.assert(this.samples.length === 2);
            console.assert(header.sampleRate === this.samples[1].header.sampleRate);
            const numFrames = Math.max(header.end - header.start, this.samples[1].header.end - this.samples[1].header.start);
            return new Sample(this.context, [this.samples[0].data, this.samples[1].data],
                header.name, numFrames, sampleRate, lowestKey, rootKey, rootFineTune, loopStart, loopEnd, loopEnabled);
        }
        throw new Error(`Unknown audio configuration (${type})`);
    }
}