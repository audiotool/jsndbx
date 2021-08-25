import {SampleBuilder} from "./sample.js";

export class Instrument {
    static fromFormat(context, format) {
        console.log(`build ${format.header.name}`);
        const zones = format.zones;
        const sampleBuilders = new Map();
        const samples = [];
        for (let i = 0; i < zones.length; i++) {
            const zone = zones[i];
            let lowestKey = zone.keyRange?.lo;
            if (lowestKey === undefined) {
                console.warn(`${format.header.name} zone ${i} has no keyRange.`);
                lowestKey = 0;
            }
            const sample = zone.sample;
            const header = sample.header;
            const sampleRate = header.sampleRate;
            if (0 === sampleRate) {
                continue;
            }
            let sampleBuilder = sampleBuilders.get(lowestKey);
            if (undefined === sampleBuilder) {
                sampleBuilder = new SampleBuilder(context, zone);
                sampleBuilders.set(lowestKey, sampleBuilder);
            }
            sampleBuilder.push(sample);
        }
        for (const entry of sampleBuilders) {
            samples.push(entry[1].make());
        }
        samples.sort((a, b) => a.lowestKey.value - b.lowestKey.value);
        let totalBytes = 0;
        for (let i = 0; i < samples.length; i++) {
            const memory = samples[i].memory;
            totalBytes += memory;
        }
        console.log(`${samples.length} samples allocating ${totalBytes >> 20}mb`);
        return new Instrument(samples);
    }

    constructor(samples) {
        this.samples = samples;
    }

    play(output, key) {
        const sample = this.findSample(key);
        if (null === sample) {
            console.warn(`Could not find sample for ${key}`);
            return null;
        }
        return sample.play(output, key);
    }

    findSample(key) {
        // TODO Use binary search
        if (this.samples.length === 0) return null;
        for (let i = this.samples.length - 1; i >= 0; --i) {
            const lowestKey = this.samples[i].lowestKey.value;
            if (key >= lowestKey) {
                return this.samples[i];
            }
        }
        return this.samples[0];
    }

    dispose() {
        while (this.samples.length) {
            this.samples.pop().dispose();
        }
    }
}