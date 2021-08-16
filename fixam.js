/**
 * SOUND-FONTs
 * http://www.synthfont.com/SFSPEC21.PDF
 * https://github.com/topics/soundfont?l=java
 * https://cymatics.fm/blogs/production/soundfonts
 * https://mrtenz.github.io/soundfont2/api/soundfont2/sample/sample-type.html
 * https://pjb.com.au/midi/sfspec21.html (best resource yet)
 * https://www.polyphone-soundfonts.com/ (mac editor)
 *
 * TODOs
 *
 */
import {Policy} from "./modules/policy.js";
import {Exp, Level, NoFloat} from "./modules/mapping.js";
import {ParameterBuilder} from "./modules/parameter.js";
import {ParameterKnob} from "./modules/editors.js";
import {readBinary, replaceElement} from "./modules/standard.js";
import {StereoMeter} from "./worklets/StereoMeter.js";
import {Midi, SoftwareKeyboard} from "./modules/sequencing.js";
import {dbToGain} from "./modules/neutrons.js";

const {SoundFont2} = window.SoundFont2;

const context = Policy.newAudioContext();
const gainNode = context.createGain();

const parameters = {
    masterGain: ParameterBuilder.begin("master-gain")
        .callback(p => gainNode.gain.value = dbToGain(p.value))
        .valueMapping(Level.DEFAULT)
        .printMapping(NoFloat)
        .unit("db")
        .value(-6.0)
        .create(),
    ampRelease: ParameterBuilder.begin("Amp Release")
        .callback(p => {
        })
        .valueMapping(new Exp(1.0, 5000.0))
        .printMapping(NoFloat)
        .unit("ms")
        .value(500.0)
        .create()
};
// Initial parameters
gainNode.gain.value = dbToGain(parameters.masterGain.value);

class SampleType {
}

// https://mrtenz.github.io/soundfont2/api/soundfont2/sample/sample-type.html
SampleType.Mono = 1; // A sample with only one (mono) channel.
SampleType.Right = 2; // A sample with two channels, where this sample is the right channel.
SampleType.Left = 4; // A sample with two channels, where this sample is the left channel.

class Sample {
    constructor(keyRange, buffer, header, loop, memory) {
        this.buffer = buffer;
        this.keyRange = keyRange;
        this.header = header;
        this.loop = loop;
        this.memory = memory;
    }

    play(note) {
        const l0 = this.header.startLoop - this.header.start;
        const l1 = this.header.endLoop - this.header.start;
        const keyDifference = note - this.header.originalPitch;
        const playbackRate = Math.pow(2.0, keyDifference / 12.0);
        const gain = context.createGain();
        const source = context.createBufferSource();
        const startTime = context.currentTime;
        gain.gain.value = 1.0;
        gain.gain.setValueAtTime(1.0, startTime);
        source.connect(gain);
        gain.connect(gainNode);
        source.buffer = this.buffer;
        source.playbackRate.value = playbackRate;
        if (this.loop) {
            const sampleRate = this.buffer.sampleRate;
            source.loopStart = l0 / sampleRate;
            source.loopEnd = l1 / sampleRate;
            source.loop = true;
        }
        source.start(startTime);
        console.log(`play ${note}`)
        return () => {
            const currentTime = context.currentTime;
            const endTime = currentTime + parameters.ampRelease.value / 1000.0;
            gain.gain.setValueAtTime(1.0, currentTime);
            gain.gain.linearRampToValueAtTime(0.0, endTime);
            source.stop(endTime);
        };
    }
}

class SampleBuilder {
    constructor(zone) {
        this.zone = zone;
        this.samples = [];
        this.memory = 0 | 0;
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

    fillBuffer(buffer, data, channelNumber) {
        const numFrames = data.length;
        const frames = new Float32Array(numFrames);
        for (let i = 0; i < numFrames; i++) {
            frames[i] = data[i] / 0x7FFF;
        }
        buffer.copyToChannel(frames, channelNumber, 0);
        this.memory += data.byteLength;
    }

    createBuffer() {
        const type = this.type();
        if (type === SampleType.Mono || type === SampleType.Left || type === SampleType.Right) {
            console.assert(this.samples.length === 1);
            const data = this.samples[0].data;
            const length = data.length;
            const sampleRate = this.samples[0].header.sampleRate;
            const buffer = context.createBuffer(1, length, sampleRate);
            this.fillBuffer(buffer, data, 0);
            return buffer;
        }
        if (type === (SampleType.Left | SampleType.Right)) {
            console.assert(this.samples.length === 2);
            console.assert(this.samples[0].header.sampleRate === this.samples[1].header.sampleRate);
            const channel0 = this.samples[0].data;
            const channel1 = this.samples[1].data;
            const length = Math.max(channel0.length, channel1.length);
            const sampleRate = this.samples[0].header.sampleRate;
            const buffer = context.createBuffer(2, length, sampleRate);
            this.fillBuffer(buffer, channel0, 0);
            this.fillBuffer(buffer, channel1, 1);
            return buffer;
        }
        throw new Error(`Unknown audio configuration (${type})`);
    }

    create() {
        return new Sample(
            this.zone.keyRange,
            this.createBuffer(),
            this.samples[0].header,
            this.zone.generators[54]?.amount === 1,
            this.memory);
    }
}

const url = "files/excludes/soundfonts/Arachno SoundFont - Version 1.0.sf2"; // 451 > 88, 89
const samples = [];
const findSample = note => {
    for (let i = samples.length - 1; i >= 0; --i) {
        const keyRange = samples[i].keyRange;
        if (note >= keyRange.lo) {
            if (note > keyRange.hi) {
                console.warn(`lo: ${keyRange.lo}, note: ${note}, high: ${keyRange.hi} (is outside the range)`)
            }
            return samples[i];
        }
    }
    return samples[0];
};
const loadInstrument = instrument => {
    if (samples.length) {
        samples.splice(0, samples.length);
        console.assert(samples.length === 0);
    }

    console.log(`load ${instrument.header.name}`);
    const zones = instrument.zones;

    const sampleBuilders = new Map();
    for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        const keyRange = zone.keyRange;
        if (!keyRange) {
            console.warn(`${instrument.header.name} zone ${i} has no keyRange.`);
            return;
        }
        const sample = zone.sample;
        const header = sample.header;
        const sampleRate = header.sampleRate;
        if (0 === sampleRate) {
            continue;
        }
        let sampleBuilder = sampleBuilders.get(keyRange.lo);
        if (undefined === sampleBuilder) {
            sampleBuilder = new SampleBuilder(zone);
            sampleBuilders.set(keyRange.lo, sampleBuilder);
        }
        sampleBuilder.push(sample);
    }

    for (const entry of sampleBuilders) {
        samples.push(entry[1].create());
    }

    samples.sort((a, b) => a.keyRange.lo - b.keyRange.lo);
    let totalBytes = 0;
    for (let i = 0; i < samples.length; i++) {
        const memory = samples[i].memory;
        totalBytes += memory;
    }
    console.log(`${samples.length} samples allocating ${totalBytes >> 20}mb`)
};
readBinary(url)
    .catch(x => alert(x))
    .then(bf => SoundFont2.from(new Uint8Array(bf)))
    .then(sf => {
        Promise.all([
            StereoMeter.load(context),
        ])
            .then(() => {
                document.getElementById("preloader").remove();
                document.querySelector(".hidden").classList.remove("hidden");
                const meter = new StereoMeter(context, 256);
                gainNode.connect(meter);
                meter.connect(context.destination);

                const replaceLocation = (parameter) => document.querySelector(`[data-parameter=${parameter}`);
                replaceElement(new ParameterKnob(parameters.masterGain).domElement, replaceLocation("master-gain"));
                replaceElement(new ParameterKnob(parameters.ampRelease).domElement, replaceLocation("amp-release"));
                document.querySelector(".env").appendChild(meter.domElement);

                const sources = document.getElementById("sources");
                const selector = sources.querySelector("select");
                const instruments = sf.instruments;
                for (let i = 0; i < instruments.length; i++) {
                    const instrument = instruments[i];
                    const numBytes = instrument.zones.reduce((n, zone) => zone.sample.data.byteLength + n, 0);
                    const name = instrument.header.name;
                    console.log(`${i}: ${name} > ${numBytes >> 10}kb`);

                    const option = document.createElement("option");
                    option.textContent = `${name} (${numBytes >> 10}kb)`;
                    selector.appendChild(option);
                }
                console.log(`${instruments.length} instruments`);
                selector.onchange = event => {
                    event.target.blur();
                    loadInstrument(instruments[event.target.selectedIndex]);
                };

                loadInstrument(instruments[0]);

                const playing = [];

                const noteOn = (note, velocity) => {
                    // console.log(`noteOn note: ${note}, velocity: ${velocity}`);
                    const sample = findSample(note);
                    if (!sample) {
                        console.warn(`Could not find sample for ${note}`);
                        return;
                    }
                    console.log(`lo: ${sample.keyRange.lo}, note: ${note}, high: ${sample.keyRange.hi}, pitch: ${sample.header.originalPitch}`)
                    playing[note] = sample.play(note);
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
            });
    });