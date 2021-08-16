import {SVG} from "./svg.js";

export class PianoRoll {
    constructor(octaveShift) {
        this.octaveShift = octaveShift;
        this.keys = [];
        this.svg = PianoRoll.createSVG(this.keys);
        this.svg.style.borderRadius = "3px";
        this.svg.addEventListener("mousedown", event => {
            // TODO console.log(event);
        });
    }

    press(index) {
        this.applyKeyStyle(index - this.octaveShift * 12, PianoRoll.BLACK_KEYS_DOWN, PianoRoll.WHITE_KEYS_DOWN);
    }

    release(index) {
        this.applyKeyStyle(index - this.octaveShift * 12, PianoRoll.BLACK_KEYS_IDLE, PianoRoll.WHITE_KEYS_IDLE);
    }

    isBlackKey(index) {
        return -1 < PianoRoll.BLACK_INDICES.indexOf(index % 12);
    }

    applyKeyStyle(index, styleBlack, styleWhite) {
        if (undefined !== this.keys[index]) {
            SVG.applyStyle(this.keys[index], this.isBlackKey(index) ? styleBlack : styleWhite);
        }
    }

    get domElement() {
        return this.svg;
    }

    static createSVG(keys) {
        const BLACK_OFFSETS = [3, 7, 15, 19, 23];
        const scale = 6;
        const numOctaves = 6;
        const svg = SVG.create(28 * numOctaves * scale, 20 * scale);
        for (let j = 0; j < numOctaves; j++) {
            for (let i = 0; i < 7; i++) {
                svg.appendChild(keys[PianoRoll.WHITE_INDICES[i] + j * 12] =
                    SVG.rect((28 * j + i * 4) * scale, 0, scale * 4, scale * 20, PianoRoll.WHITE_KEYS_IDLE));
            }
            for (let i = 0; i < 5; i++) {
                svg.appendChild(keys[PianoRoll.BLACK_INDICES[i] + j * 12] =
                    SVG.rect((28 * j + BLACK_OFFSETS[i]) * scale, 0, scale * 2, scale * 14, PianoRoll.BLACK_KEYS_IDLE));
            }
        }
        return svg;
    }
}

PianoRoll.WHITE_INDICES = [0, 2, 4, 5, 7, 9, 11];
PianoRoll.BLACK_INDICES = [1, 3, 6, 8, 10];
PianoRoll.WHITE_KEYS_IDLE = {"stroke": "#555555", "fill": "#FFFFF7"};
PianoRoll.BLACK_KEYS_IDLE = {"stroke": "#979797", "fill": "#4B4B4B"};
PianoRoll.WHITE_KEYS_DOWN = {"stroke": "#555555", "fill": "#28E5FF"};
PianoRoll.BLACK_KEYS_DOWN = {"stroke": "#979797", "fill": "#28E5FF"};