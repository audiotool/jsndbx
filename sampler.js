import {Policy} from "./modules/policy.js";
import {Midi, SoftwareKeyboard} from "./modules/sequencing.js";

const context = Policy.newAudioContext();
const masterGain = context.createGain();
masterGain.gain.value = 0.5;
masterGain.connect(context.destination);

class SampleType {
}

SampleType.Mono = 1; // A sample with only one (mono) channel.
SampleType.Right = 2; // A sample with two channels, where this sample is the right channel.
SampleType.Left = 4; // A sample with two channels, where this sample is the left channel.

class Sample {
    constructor(data, sampleRate, lowestKey, rootNote, rootFineTune, loopStart, loopEnd, loopEnabled) {
        this.data = data;
        this.sampleRate = sampleRate | 0;
        this.lowestKey = lowestKey | 0;
        this.rootNote = rootNote | 0;
        this.rootFineTune = rootFineTune | 0;
        this.loopStart = loopStart | 0;
        this.loopEnd = loopEnd | 0;
        this.loopEnabled = loopEnabled | false;

        this.lazyBuffer = null;
    }

    play(output, note) {
        const l0 = this.loopStart;
        const l1 = this.loopEnd;
        const keyDifference = note - this.rootNote;
        const playbackRate = Math.pow(2.0, keyDifference / 12.0); // TODO rootFineTune
        const gain = context.createGain();
        const source = context.createBufferSource();
        const startTime = context.currentTime;
        gain.gain.value = 1.0;
        gain.gain.setValueAtTime(1.0, startTime);
        source.connect(gain);
        gain.connect(output);
        source.buffer = this.buffer;
        source.playbackRate.value = playbackRate;
        if (this.loopEnabled) {
            const sampleRate = this.sampleRate;
            source.loopStart = l0 / sampleRate;
            source.loopEnd = l1 / sampleRate;
            source.loop = true;
        }
        source.start(startTime);
        return () => {
            const currentTime = context.currentTime;
            const endTime = currentTime + 0.1;
            gain.gain.setValueAtTime(1.0, currentTime);
            gain.gain.linearRampToValueAtTime(0.0, endTime);
            source.stop(endTime);
        };
    }

    get buffer() {
        if (null === this.lazyBuffer) {
            const numChannels = this.data.length;
            console.assert(0 < numChannels && numChannels <= 2);
            this.lazyBuffer = context.createBuffer(numChannels, this.data[0].length, this.sampleRate);
            for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
                const shortArray = this.data[channelIndex];
                const numFrames = shortArray.length;
                const floatArray = new Float32Array(numFrames);
                for (let frameIndex = 0; frameIndex < numFrames; frameIndex++) {
                    floatArray[frameIndex] = shortArray[frameIndex] / 0x7FFF;
                }
                this.lazyBuffer.copyToChannel(floatArray, channelIndex, 0);
            }
        }
        return this.lazyBuffer;
    }
}

class SampleBuilder {
    static fromInstrument(instrument) {
        console.log(`load ${instrument.header.name}`);
        const zones = instrument.zones;
        const sampleBuilders = new Map();
        const samples = [];
        for (let i = 0; i < zones.length; i++) {
            const zone = zones[i];
            const lowestKey = zone.keyRange?.lo;
            if (lowestKey === undefined) {
                console.warn(`${instrument.header.name} zone ${i} has no keyRange.`);
                return;
            }
            const sample = zone.sample;
            const header = sample.header;
            const sampleRate = header.sampleRate;
            if (0 === sampleRate) {
                continue;
            }
            let sampleBuilder = sampleBuilders.get(lowestKey);
            if (undefined === sampleBuilder) {
                sampleBuilder = new SampleBuilder(zone);
                sampleBuilders.set(lowestKey, sampleBuilder);
            }
            sampleBuilder.push(sample);
        }

        for (const entry of sampleBuilders) {
            samples.push(entry[1].build());
        }

        samples.sort((a, b) => a.lowestKey - b.lowestKey);
        let totalBytes = 0;
        for (let i = 0; i < samples.length; i++) {
            const memory = samples[i].memory;
            totalBytes += memory;
        }
        console.log(`${samples.length} samples allocating ${totalBytes >> 20}mb`);
        return samples;
    }

    constructor(zone) {
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

    build() {
        console.assert(this.samples.length > 0);
        const header = this.samples[0].header;
        const sampleRate = header.sampleRate;
        const rootNote = header.originalPitch;
        const rootFineTune = 0; // TODO
        const lowestKey = this.zone.keyRange.lo;
        const loopStart = header.startLoop - header.start;
        const loopEnd = header.endLoop - header.start;
        const loopEnabled = this.zone.generators[54]?.amount === 1;
        const type = this.type();
        if (type === SampleType.Mono || type === SampleType.Left || type === SampleType.Right) {
            if (this.samples.length > 1) console.warn("Mono sample has more than one channel");
            return new Sample([this.samples[0].data],
                sampleRate, lowestKey, rootNote, rootFineTune, loopStart, loopEnd, loopEnabled);
        }
        if (type === (SampleType.Left | SampleType.Right)) {
            console.assert(this.samples.length === 2);
            console.assert(header.sampleRate === this.samples[1].header.sampleRate);
            return new Sample([this.samples[0].data, this.samples[1].data],
                sampleRate, lowestKey, rootNote, rootFineTune, loopStart, loopEnd, loopEnabled);
        }
        throw new Error(`Unknown audio configuration (${type})`);
    }
}

// PLAYBACK
const playing = [];
const samples = [];
const findSample = note => {
    if (samples.length === 0) return;
    for (let i = samples.length - 1; i >= 0; --i) {
        const lowestKey = samples[i].lowestKey;
        if (note >= lowestKey) {
            // if (note > keyRange.hi) {
            //     console.warn(`lo: ${keyRange.lo}, note: ${note}, high: ${keyRange.hi} (is outside the range)`)
            // }
            return samples[i];
        }
    }
    return samples[0];
};
const noteOn = (note, velocity) => {
    // console.log(`noteOn note: ${note}, velocity: ${velocity}`);
    const sample = findSample(note);
    if (!sample) {
        console.warn(`Could not find sample for ${note}`);
        return;
    }
    playing[note] = sample.play(masterGain, note);
};
const noteOff = (note) => {
    // console.log(`noteOff note: ${note}`);
    if (playing[note]) {
        playing[note]();
        delete playing[note];
    }
};

Midi.request().then(midi => {
    const events = Midi.mapAllEvents(midi);
    events.onNoteOn = (note, velocity) => noteOn(note, velocity);
    events.onNoteOff = (note) => noteOff(note);
});
SoftwareKeyboard.init((note, velocity) => noteOn(note, velocity), note => noteOff(note));

const importInstrument = instrument => {
    console.log(instrument);
    samples.splice.apply(samples, [0, samples.length].concat(SampleBuilder.fromInstrument(instrument)));
};


const importSourcesSelect = document.querySelector("#input-sources");
const instrumentOptionMap = new Map();
const listInstruments = (fileName, instruments) => {
    const list = document.createElement("optgroup");
    list.label = `💾 ${fileName}`;
    for (let i = 0; i < instruments.length; i++) {
        const instrument = instruments[i];
        const numBytes = instrument.zones.reduce((n, zone) => zone.sample.data.byteLength + n, 0);
        const name = instrument.header.name;
        console.log(`${i}: ${name} > ${numBytes >> 10}kb`);
        const option = document.createElement("option");
        option.textContent = `${name} (${numBytes >> 10}kb)`;
        list.appendChild(option);
        instrumentOptionMap.set(option, instrument);
    }
    importSourcesSelect.prepend(list);
};
document.querySelector("#import-source").onclick = () => {
    const option = importSourcesSelect.options[importSourcesSelect.selectedIndex];
    if (-1 === importSourcesSelect.selectedIndex) return;
    if (undefined === option) return;
    const instrument = instrumentOptionMap.get(option);
    document.querySelector("#instrument-name").textContent = instrument.header?.name;
    importInstrument(instrument);
    importSourcesSelect.selectedIndex = -1;
};
document.querySelector("#input-soundfont-file").oninput = event => {
    const target = event?.target;
    if (target === undefined) return;
    const files = target?.files;
    if (files === undefined || files.length === 0) return;
    const file = files[0];
    const fileReader = new FileReader();
    const complete = sf => {
        target.value = null;
        if (null === sf) {
            alert(`${file.name} could not be imported.`);
        } else {
            listInstruments(file.name, sf.instruments);
        }
    };
    fileReader.onload = () => {
        try {
            // noinspection JSCheckFunctionSignatures
            complete(SoundFont2.SoundFont2.from(new Uint8Array(fileReader.result)));
        } catch (e) {
            console.warn(e);
            complete(null);
        }
    };
    fileReader.onerror = () => complete(null);
    fileReader.readAsArrayBuffer(file);
}