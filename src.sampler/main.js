import {Policy} from "../modules/policy.js";
import {Midi, SoftwareKeyboard} from "../modules/sequencing.js";
import {Instrument} from "./instrument.js";
import {ArrayPlotter} from "../modules/plotter.js";

const context = Policy.newAudioContext();
const masterGain = context.createGain();
masterGain.gain.value = 0.5;
masterGain.connect(context.destination);

window.onerror = event => {
    console.log(event);
    alert(`An error occurred. Please reload.`);
};

let instrument = null;

// PLAYBACK
const playing = [];
const noteOn = (key, velocity) => {
    console.log(`noteOn note: ${key}, velocity: ${velocity}`);
    playing[key] = instrument?.play(masterGain, key);
};
const noteOff = (key) => {
    console.log(`noteOff note: ${key}`);
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

class SampleWaveform {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.canvas = wrapper.querySelector("canvas");
        this.context = this.canvas.getContext("2d");
        this.sample = null;
    }

    show(sample) {
        if (this.sample === sample) {
            return;
        }
        this.sample = sample;
        this.update();
    }

    update() {
        const w = this.wrapper.clientWidth;
        const h = this.wrapper.clientHeight;
        this.canvas.width = w;
        this.canvas.height = h;

        if (null === this.sample) return;

        this.context.fillStyle = "#888";

        const numChannels = this.sample.data.length;
        for (let i = 0; i < numChannels; i++) {
            ArrayPlotter.renderOversampled(this.context, this.sample.data[i],
                0, w, h / numChannels * i, h / numChannels * (i + 1),
                0, this.sample.numFrames.value, -0x7FFF, 0x7FFF);
        }
    }
}

const sampleWaveform = new SampleWaveform(document.querySelector("div#waveform"));

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
            window.getSelection().removeAllRanges();
        }, {once: true});
    });
};

class SampleList {
    constructor(tableElement) {
        this.tableElement = tableElement;
        this.tableBody = this.tableElement.appendChild(document.createElement("tbody"));
    }

    clear() {
        this.tableBody.querySelectorAll("tr").forEach(entry => entry.remove());
    }

    build(instrument) {
        const createValueCell = (tableRowElement) => {
            const cellElement = document.createElement("td");
            cellElement.contentEditable = "true";
            tableRowElement.appendChild(cellElement);
            return cellElement;
        };
        for (let i = 0; i < instrument.samples.length; i++) {
            const sample = instrument.samples[i];
            const tableRowElement = document.createElement("tr");

            tableRowElement.addEventListener("focusin", () => sampleWaveform.show(sample));

            // TODO ReadOnly fields

            makeValueField(createValueCell(tableRowElement), sample.lowestKey);
            makeValueField(createValueCell(tableRowElement), sample.name);
            createValueCell(tableRowElement).textContent = sample.data.length;
            makeValueField(createValueCell(tableRowElement), sample.rootKey);
            makeValueField(createValueCell(tableRowElement), sample.rootFineTune);
            makeValueField(createValueCell(tableRowElement), sample.numFrames);
            makeValueField(createValueCell(tableRowElement), sample.loopStart);
            makeValueField(createValueCell(tableRowElement), sample.loopEnd);
            makeValueField(createValueCell(tableRowElement), sample.loopEnabled);
            makeValueField(createValueCell(tableRowElement), sample.sampleRate);
            createValueCell(tableRowElement).textContent = (sample.data.reduce((n, x) => n + x.byteLength, 0) >> 10) + 1;

            sample.numPlaying.addObserver(value => {
                if (value.value) tableRowElement.classList.add("playing")
                else tableRowElement.classList.remove("playing")
            });

            this.tableBody.appendChild(tableRowElement);
        }
    }
}

const sampleList = new SampleList(document.querySelector("table#sample-list"));

const importInstrument = format => {
    sampleList.clear();
    instrument?.dispose();
    instrument = Instrument.fromFormat(context, format);
    sampleList.build(instrument);
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
document.querySelector("#input-file").oninput = event => {
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
document.querySelector(".save button").onclick = () => alert("Not yet implemented");
if (location.hostname === "localhost")
    fetch("files/soundfont/cms fat saw.sf2")
        .then(x => x.arrayBuffer())
        .then(x => {
            const instruments = SoundFont2.SoundFont2.from(new Uint8Array(x)).instruments;
            listInstruments("local", instruments);
            importInstrument(instruments[0]);
        });