import {Policy} from "../modules/policy.js";
import {Midi, SoftwareKeyboard} from "../modules/sequencing.js";
import {Sample, SampleBuilder} from "./sample.js";

const context = Policy.newAudioContext();
const masterGain = context.createGain();
masterGain.gain.value = 0.5;
masterGain.connect(context.destination);

window.onerror = event => {
    console.log(event);
    alert(`An error occurred. Please reload.`);
};

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

            sample.numPlaying.addObserver(value => {
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
    samples.push.apply(samples, SampleBuilder.fromInstrument(context, instrument));
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