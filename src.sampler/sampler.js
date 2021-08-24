import {Policy} from "../modules/policy.js";
import {Midi, SoftwareKeyboard} from "../modules/sequencing.js";
import {PrintMapping, Value} from "../modules/value.js";

const context = Policy.newAudioContext();
const masterGain = context.createGain();
masterGain.gain.value = 0.5;
masterGain.connect(context.destination);

window.onerror = event => {
    console.log(event);
    alert(`An error occurred. Please reload.`);
};

class SampleType {
}

SampleType.Mono = 1; // A sample with only one (mono) channel.
SampleType.Right = 2; // A sample with two channels, where this sample is the right channel.
SampleType.Left = 4; // A sample with two channels, where this sample is the left channel.

class Sample {
    constructor(data, name, numFrames, sampleRate, lowestKey, rootKey, rootFineTune, loopStart, loopEnd, loopEnabled) {
        this.data = data;
        this.name = new Value(name, PrintMapping.Any);
        this.numFrames = new Value(numFrames | 0, PrintMapping.PositiveInteger);
        this.sampleRate = new Value(sampleRate | 0, PrintMapping.PositiveInteger);
        this.lowestKey = new Value(lowestKey | 0, PrintMapping.LinearInt(0, 127));
        this.rootKey = new Value(rootKey | 0, PrintMapping.LinearInt(0, 127));
        this.rootFineTune = new Value(rootFineTune | 0, PrintMapping.LinearInt(0, 127));
        this.loopStart = new Value(loopStart | 0, PrintMapping.PositiveInteger);
        this.loopEnd = new Value(loopEnd | 0, PrintMapping.PositiveInteger);
        this.loopEnabled = new Value(loopEnabled | 0, PrintMapping.Boolean);

        this.playing = new Value(0, PrintMapping.PositiveInteger);

        this.optBuffer = null;

        const invalidator = () => this.optBuffer = null;
        this.numFrames.addObserver(invalidator);
        this.sampleRate.addObserver(invalidator);
    }

    play(output, note) {
        const keyDifference = note - this.rootKey.value;
        const playbackRate = Math.pow(2.0, keyDifference / 12.0 + this.rootFineTune.value / 1200.0);
        const gain = context.createGain();
        const source = context.createBufferSource();
        const startTime = context.currentTime;
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
        source.onended = () => this.playing.value--;
        source.start(startTime);
        this.playing.value++;
        return () => {
            const currentTime = context.currentTime;
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
            this.optBuffer = context.createBuffer(numChannels, this.data[0].length, this.sampleRate.value);
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

class SampleBuilder {
    static fromInstrument(instrument) {
        console.log(`build ${instrument.header.name}`);
        const zones = instrument.zones;
        const sampleBuilders = new Map();
        const samples = [];
        for (let i = 0; i < zones.length; i++) {
            const zone = zones[i];
            let lowestKey = zone.keyRange?.lo;
            if (lowestKey === undefined) {
                console.warn(`${instrument.header.name} zone ${i} has no keyRange.`);
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
            return new Sample([this.samples[0].data],
                header.name, numFrames, sampleRate, lowestKey, rootKey, rootFineTune, loopStart, loopEnd, loopEnabled);
        }
        if (type === (SampleType.Left | SampleType.Right)) {
            console.assert(this.samples.length === 2);
            console.assert(header.sampleRate === this.samples[1].header.sampleRate);
            const numFrames = Math.max(header.end - header.start, this.samples[1].header.end - this.samples[1].header.start);
            return new Sample([this.samples[0].data, this.samples[1].data],
                header.name, numFrames, sampleRate, lowestKey, rootKey, rootFineTune, loopStart, loopEnd, loopEnabled);
        }
        throw new Error(`Unknown audio configuration (${type})`);
    }
}

// PLAYBACK
const playing = [];
const samples = [];
const findSample = key => {
    if (samples.length === 0) return;
    for (let i = samples.length - 1; i >= 0; --i) {
        const lowestKey = samples[i].lowestKey.value;
        if (key >= lowestKey) {
            // if (key > keyRange.hi) {
            //     console.warn(`lo: ${keyRange.lo}, key: ${key}, high: ${keyRange.hi} (is outside the range)`)
            // }
            return samples[i];
        }
    }
    return samples[0];
};
const noteOn = (key, velocity) => {
    // console.log(`noteOn note: ${key}, velocity: ${velocity}`);
    const sample = findSample(key);
    if (!sample) {
        console.warn(`Could not find sample for ${key}`);
        return;
    }
    playing[key] = sample.play(masterGain, key);
};
const noteOff = (key) => {
    // console.log(`noteOff note: ${note}`);
    if (playing[key]) {
        playing[key]();
        delete playing[key];
    }
};

Midi.request().then(midi => {
    const events = Midi.mapAllEvents(midi);
    events.onNoteOn = (note, velocity) => noteOn(note, velocity);
    events.onNoteOff = (note) => noteOff(note);
});
SoftwareKeyboard.init((note, velocity) => noteOn(note, velocity), note => noteOff(note));

const makeValueField = (element, value) => {
    const update = () => element.textContent = value.print();
    value.addObserver(_ => update());
    update();
    element.addEventListener("focusin", () => {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);
        const oldString = value.print();
        const onKeyDown = event => {
            if (event.key === "Enter") {
                element.blur();
            } else if (event.key === "Escape") {
                element.textContent = oldString;
                element.blur();
            }
        };
        element.addEventListener("keydown", onKeyDown);
        element.addEventListener("focusout", () => {
            element.removeEventListener("keydown", onKeyDown);
            value.parse(element.textContent);
        }, {once: true});
    });
};

class SampleList {
    constructor(tableElement) {
        this.tableElement = tableElement;
    }

    clear() {
        this.tableElement.querySelectorAll("tr:not([header])").forEach(entry => entry.remove());
    }

    build() {
        const createValueCell = (tableRowElement) => {
            const cellElement = document.createElement("td");
            cellElement.contentEditable = "true";
            tableRowElement.appendChild(cellElement);
            return cellElement;
        };
        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            const tableRowElement = document.createElement("tr");

            // TODO ReadOnly fields

            makeValueField(createValueCell(tableRowElement), sample.lowestKey);
            makeValueField(createValueCell(tableRowElement), sample.name);
            makeValueField(createValueCell(tableRowElement), sample.numFrames);
            makeValueField(createValueCell(tableRowElement), sample.rootKey);
            makeValueField(createValueCell(tableRowElement), sample.rootFineTune);
            makeValueField(createValueCell(tableRowElement), sample.loopStart);
            makeValueField(createValueCell(tableRowElement), sample.loopEnd);
            makeValueField(createValueCell(tableRowElement), sample.loopEnabled);
            makeValueField(createValueCell(tableRowElement), sample.sampleRate);

            sample.playing.addObserver(value => {
                if (value.value) tableRowElement.classList.add("playing")
                else tableRowElement.classList.remove("playing")
            });

            this.tableElement.appendChild(tableRowElement);
        }
    }
}

const sampleList = new SampleList(document.querySelector("table#sample-list"));

const importInstrument = instrument => {
    sampleList.clear();
    while (samples.length) {
        samples.pop().dispose();
    }
    samples.push.apply(samples, SampleBuilder.fromInstrument(instrument));
    sampleList.build();
};

const importSourcesSelect = document.querySelector("#input-sources");
const listInstruments = (fileName, instruments) => {
    importSourcesSelect.firstElementChild?.remove();
    const list = document.createElement("optgroup");
    list.label = `💾 ${fileName}`;
    for (let i = 0; i < instruments.length; i++) {
        const instrument = instruments[i];
        const numBytes = instrument.zones.reduce((n, zone) => zone.sample.data.byteLength + n, 0);
        const name = instrument.header.name;
        console.log(`${i}: ${name} > ${numBytes >> 10}kb`);
        const option = document.createElement("option");
        option.textContent = `${name} (${numBytes >> 10}kb)`;
        option.ondblclick = () => {
            importSourcesSelect.selectedIndex = -1;
            importSourcesSelect.blur();
            importInstrument(instrument);
        }
        list.appendChild(option);
    }
    importSourcesSelect.prepend(list);
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
            alert(`${file.name}
            could
            not
            be
            imported.`);
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