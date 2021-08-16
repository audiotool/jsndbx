import {ParameterBuilder} from "./parameter.js";
import {Linear, Percent, LinearInt, PrintMapping, NoFloat, OneFloat} from "./mapping.js";
import {Random} from "./neutrons.js";

export class Sequencer {
    constructor(timer) {
        this.timer = timer || (() => performance.now());
        this.absoluteTime = 0.0;
        this.nextScheduleTime = 0.0;
        this.processors = [];
        this.latency = [];
        this.$bpm = 120.0;
        this.$intervalId = -1;
        this.bpm = ParameterBuilder
            .begin("Bpm")
            .valueMapping(new Linear(30.0, 300.0))
            .printMapping(OneFloat)
            .value(120)
            .unit("")
            .callback(p => {
                const bars = this.millisToBars(this.absoluteTime);
                this.$bpm = p.value;
                this.absoluteTime = this.barsToMillis(bars);
            })
            .create();
    }

    offline(duration) {
        const n = this.processors.length;
        for (let i = 0; i < n; ++i) {
            this.processors[i](this, 0.0, duration);
        }
    }

    start() {
        if (-1 < this.$intervalId) {
            return;
        }
        this.nextScheduleTime = this.currentMillis() + Sequencer.LOOK_AHEAD_TIME;
        this.$intervalId = setInterval(_ => {
            const now = this.currentMillis();
            if (now + Sequencer.LOOK_AHEAD_TIME >= this.nextScheduleTime) {
                const m0 = this.absoluteTime;
                const m1 = m0 + Sequencer.SCHEDULE_TIME;
                const n = this.processors.length;
                for (let i = 0; i < n; ++i) {
                    const latency = this.latency[i];
                    const t0 = this.millisToBars(m0 + latency.delay, this.$bpm);
                    const t1 = this.millisToBars(m1 + latency.delay, this.$bpm);
                    this.processors[i](latency.computeStartMillis, t0, t1);
                }
                this.absoluteTime += Sequencer.SCHEDULE_TIME;
                this.nextScheduleTime += Sequencer.SCHEDULE_TIME;
            }
        }, Sequencer.INTERVAL);
    }

    stop() {
        this.pause();
        this.absoluteTime = 0.0;
    }

    pause() {
        if (-1 === this.$intervalId) {
            return;
        }
        clearInterval(this.$intervalId);
        this.$intervalId = -1;
    }

    playMode(value) {
        if (value) {
            this.start();
        } else {
            this.stop();
        }
    }

    currentMillis() {
        return this.timer();
    }

    toggle() {
        if (-1 === this.$intervalId) {
            this.start();
        } else {
            this.pause();
        }
    }

    addProcessor(processor, delay) {
        delay = delay || 0.0;
        this.processors.push(processor);
        this.latency.push({
            delay: delay,
            computeStartMillis: barPosition => this.computeStartMillis(barPosition) + delay
        });
    }

    computeStartMillis(barPosition) {
        return (this.nextScheduleTime - this.absoluteTime) +
            this.barsToMillis(barPosition, this.$bpm) + Sequencer.ADDITIONAL_LATENCY;
    }

    barsToMillis(bars) {
        return bars * 240000.0 / this.$bpm;
    };

    millisToBars(millis) {
        return millis * this.$bpm / 240000.0;
    };

    bars() {
        return this.absoluteTime * this.$bpm / 240000.0;
    }
}

Sequencer.INTERVAL = 1.0;
Sequencer.LOOK_AHEAD_TIME = 10.0;
Sequencer.SCHEDULE_TIME = 10.0;
Sequencer.ADDITIONAL_LATENCY = 10.0;

export class Fragmentation {
    // (computeStartMillis, stepIndex, position, complete) => {}
    constructor(callback, scale) {
        this.callback = callback;
        this.scale = scale;
        this.groove = Groove.NONE;
    }

    equalise(computeStartMillis, t0, t1) {
        t0 = this.groove.renormalise(t0);
        t1 = this.groove.renormalise(t1);
        let index = (t0 / this.scale) | 0;
        if (index < 0) {
            return;
        }
        let barPosition = index * this.scale;
        while (barPosition < t1) {
            if (barPosition >= t0) {
                this.callback(computeStartMillis, index, this.groove.transform(barPosition), this.groove.transform(barPosition + this.scale));
            }
            barPosition = ++index * this.scale
        }
    }
}

export class Groove {
    renormalise(position) {
        const duration = this.duration();
        const start = Math.floor(position / duration) * duration;
        const normalized = (position - start) / duration;
        const transformed = this.inverse(normalized);
        return start + transformed * duration;
    }

    transform(position) {
        const duration = this.duration();
        const start = Math.floor(position / duration) * duration;
        const normalized = (position - start) / duration;
        const transformed = this.forward(normalized);
        return start + transformed * duration;
    }

    forward(x) {
        return x;
    }

    inverse(y) {
        return y;
    }

    duration() {
        return 1.0;
    }
}

export class GrooveShuffle extends Groove {
    constructor(impact) {
        super();
        this.impact = ParameterBuilder
            .begin("Shuffle")
            .valueMapping(new Linear(0.05, 0.95))
            .printMapping(Percent)
            .value(impact || 0.5)
            .create();
    }

    forward(x) {
        return Math.pow(x, (1.0 - this.impact.value) * 2.0);
    }

    inverse(y) {
        return Math.pow(y, 0.5 / (1.0 - this.impact.value));
    }

    duration() {
        return 1.0 / 8.0;
    }
}

Groove.NONE = new Groove();

export class NoteEvent {
    constructor(note, velocity) {
        this.note = note;
        this.velocity = velocity;
    }
}

export class EventRetainer {
    constructor() {
        this.events = new Map();
    }

    push(event, endTime) {
        this.events.set(endTime, event);
    }

    getCompleted(time) {
        if (0 === this.events.size) {
            return EventRetainer.EMPTY;
        }
        let result = null;
        for (let entry of this.events) {
            if (entry[0] < time) {
                if (null === result) {
                    result = [];
                }
                result.push(entry);
                this.events.delete(entry[0]);
            }
        }
        return null === result ? EventRetainer.EMPTY : result;
    }
}

EventRetainer.EMPTY = [];

export class Arpeggio {
    constructor(modes, names) {
        this.modes = modes ||
            [Arpeggio.MODE_UP, Arpeggio.MODE_DOWN, Arpeggio.MODE_UP_DOWN, Arpeggio.MODE_ZIGZAG, Arpeggio.MODE_RANDOM];
        this.names = names ||
            ["Up", "Down", "Up & Down", "Zigzag", "Random"];
        this.stack = [];
        this.octaves = ParameterBuilder
            .begin("Octaves")
            .valueMapping(new LinearInt(1, 5))
            .printMapping(NoFloat)
            .unit("")
            .value(1)
            .create();
        this.mode = ParameterBuilder
            .begin("Mode")
            .valueMapping(new LinearInt(0, this.modes.length - 1))
            .printMapping(PrintMapping.create((mapping, unipolar) => this.names[mapping.y(unipolar)]))
            .unit("")
            .value(0)
            .create();
        this.removeOnNextStep = true;
        this.removeQueue = [];
    }

    noteOn(note, velocity) {
        this.stack.push(new NoteEvent(note, velocity));
    }

    noteOff(note) {
        if (this.removeOnNextStep) {
            this.removeQueue.push(note);
        } else {
            this.remove(note);
        }
    }

    eventFor(stepIndex) {
        const size = this.stack.length;
        if (0 === size) {
            return null;
        }
        const event = this.modes[this.mode.value](this.stack, this.octaves.value, stepIndex, size);
        while (0 < this.removeQueue.length) {
            this.remove(this.removeQueue.pop());
        }
        return event;
    }

    remove(note) {
        this.stack = this.stack.filter(o => o.note !== note);
    }
}

Arpeggio.MODE_UP = (stack, octaves, stepIndex, size) => {
    const amount = size * octaves;
    const localIndex = stepIndex % size;
    const octave = Math.floor((stepIndex % amount) / size);
    const event = stack[localIndex];
    return new NoteEvent(event.note + octave * 12, event.velocity);
};
Arpeggio.MODE_DOWN = (stack, octaves, stepIndex, size) => {
    const amount = size * octaves;
    const localIndex = (size - 1) - stepIndex % size;
    const octave = (octaves - 1) - Math.floor((stepIndex % amount) / size);
    const event = stack[localIndex];
    return new NoteEvent(event.note + octave * 12, event.velocity);
};
Arpeggio.MODE_UP_DOWN = (stack, octaves, stepIndex, size) => {
    const amount = size * octaves;
    const sequenceLength = Math.max(1, amount * 2 - 2);
    const sequenceIndex = stepIndex % sequenceLength;
    const processIndex = (sequenceIndex < amount ? sequenceIndex : sequenceLength - sequenceIndex);
    const index = processIndex % size;
    const octave = Math.floor(processIndex / size);
    const event = stack[index];
    return new NoteEvent(event.note + octave * 12, event.velocity);
};
Arpeggio.MODE_ZIGZAG = (() => {
    const mapSize = (size) => 1 >= size ? 1 : (size - 1) << 1;
    const mapIndex = (stepIndex, size) => {
        const length = mapSize(size);
        const local = 0 === length ? stepIndex : stepIndex % length;
        return local < size ? local : length - local;
    };
    return (stack, octaves, stepIndex, size) => {
        const index = mapIndex(stepIndex, size);
        const octave = mapIndex(Math.floor(stepIndex / mapSize(size)), octaves);
        const event = stack[index];
        return new NoteEvent(event.note + octave * 12, event.velocity);
    };
})();
Arpeggio.MODE_RANDOM = ((seed) => {
    const random = new Random(seed);
    return (stack, octaves, stepIndex, size) => {
        random.seed = seed + stepIndex * 0xDEAF;
        const index = random.nextInt(size);
        const octave = random.nextInt(octaves);
        const event = stack[index];
        return new NoteEvent(event.note + octave * 12, event.velocity);
    }
})(0xF303F);

export class MidiData {
    static noteOn(channel, note, velocity) {
        const bytes = new Uint8Array(3);
        bytes[0] = channel | MidiData.CmdNoteOn;
        bytes[1] = note | 0;
        bytes[2] = velocity | 0;
        return bytes;
    };

    static noteOff(channel, note) {
        const bytes = new Uint8Array(3);
        bytes[0] = channel | MidiData.CmdNoteOff;
        bytes[1] = note;
        return bytes;
    };

    static isNoteOn(data) {
        return MidiData.command(data) === MidiData.CmdNoteOn;
    }

    static readNote(data) {
        return data[1];
    }

    static readVelocity(data) {
        return data[2] / 127.0;
    }

    static isNoteOff(data) {
        return MidiData.command(data) === MidiData.CmdNoteOff;
    }

    static isPitchWheel(data) {
        return MidiData.command(data) === MidiData.CmdPitchBend;
    }

    static asPitchBend(data) {
        const p1 = MidiData.param1(data) & 0x7F;
        const p2 = MidiData.param2(data) & 0x7F;
        const value = p1 | p2 << 7;
        return 8192 >= value ? value / 8192.0 - 1.0 : (value - 8191) / 8192.0;
    }

    static isController(data) {
        return MidiData.command(data) === MidiData.CmdController;
    }

    static asValue(data) {
        const value = MidiData.param2(data);
        if (64 < value) {
            return 0.5 + (value - 63) / 128;
        } else if (64 > value) {
            return value / 128;
        } else {
            return 0.5;
        }
    }

    static command(data) {
        return data[0] & 0xF0;
    }

    static param1(data) {
        return 1 < data.length ? data[1] & 0xFF : 0;
    }

    static param2(data) {
        return 2 < data.length ? data[2] & 0xFF : 0;
    }
}

MidiData.CmdNoteOn = 0x90;
MidiData.CmdNoteOff = 0x80;
MidiData.CmdPitchBend = 0xE0;
MidiData.CmdController = 0xB0;

export class Midi {
    static request() {
        return navigator.requestMIDIAccess()
            .catch(error => console.error(error))
            .then(midi => {
                console.log("Initialised Midi...");
                return midi;
            });
    }

    static panic(midi) {
        console.log("MIDI PANIC");
        for (let note = 0; note < 128; note++) {
            for (let channel = 0; channel < 16; channel++) {
                const data = MidiData.noteOff(channel, note);
                const event = new MessageEvent("midimessage", {data: data});
                for (let input of midi.inputs.values()) {
                    input.onmidimessage(event);
                }
                for (let output of midi.outputs.values()) {
                    output.send(data);
                }
            }
        }
    }

    static installPanic(midi) {
        window.addEventListener("keydown", event => {
            if (!event.repeat && (event.ctrlKey || event.metaKey) && event.key === "p") {
                event.preventDefault();
                Midi.panic(midi);
            }
        });
    }

    static mapAllEvents(midi) {
        const events = {
            onNoteOn: (note, velocity) => console.warn("onNoteOn not defined.", note, velocity),
            onNoteOff: (note) => console.warn("onNoteOff not defined.", note),
            onPitchWheel: (bipolar) => console.warn("onPitchWheel not defined.", bipolar),
            onController: (id, unipolar) => console.warn("onController not defined.", id, unipolar)
        };
        for (let input of midi.inputs.values()) {
            input.addEventListener("midimessage", event => {
                const data = event.data;
                if (MidiData.isNoteOn(data)) {
                    events.onNoteOn(MidiData.readNote(data), MidiData.readVelocity(data));
                } else if (MidiData.isNoteOff(data)) {
                    events.onNoteOff(MidiData.readNote(data));
                } else if (MidiData.isPitchWheel(data)) {
                    events.onPitchWheel(MidiData.asPitchBend(data));
                } else if (MidiData.isController(data)) {
                    events.onController(MidiData.param1(data), MidiData.asValue(data));
                }
            });
        }
        return events;
    }

    static thru(midi, output) {
        for (let input of midi.inputs.values()) {
            input.addEventListener("midimessage", event => output.send(event.data));
        }
    }
}

export class SoftwareKeyboard {
    static init(onNoteOn, onNoteOff) {
        const active = [];
        window.addEventListener("keydown", event => {
            if (event.repeat || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const keyIndex = SoftwareKeyboard.keyMap[event.key.toUpperCase()];
            if (keyIndex === undefined || active[keyIndex]) {
                return;
            }
            active[keyIndex] = true;
            onNoteOn(keyIndex + 36, 1.0);
        }, false);
        window.addEventListener("keyup", event => {
            const keyIndex = SoftwareKeyboard.keyMap[event.key.toUpperCase()];
            if (keyIndex === undefined) {
                return;
            }
            active[keyIndex] = false;
            onNoteOff(keyIndex + 36);
        }, false);
    }
}

SoftwareKeyboard.keyMap = {
    2: 13,
    3: 15,
    5: 18,
    6: 20,
    7: 22,
    Z: 0,
    X: 2,
    C: 4,
    V: 5,
    B: 7,
    N: 9,
    M: 11,
    Q: 12,
    W: 14,
    E: 16,
    R: 17,
    T: 19,
    Y: 21,
    U: 23,
    I: 24,
    S: 1,
    D: 3,
    G: 6,
    H: 8,
    J: 10
};