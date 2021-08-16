import {Linear} from "./mapping.js";

export const clamp = (min, max, value) => {
    return min > value ? min : max < value ? max : value;
};
export const ceilTo = (value, step) => Math.ceil(value / step) * step;
export const sortIndices = (array, compare) => {
    const indices = new Uint32Array(array.length);
    for (let i = 0; i < array.length; i++) {
        indices[i] = i;
    }
    indices.sort((a, b) => compare(array[a], array[b]));
    return indices;
};
export const maxima = (signal, thresh) => {
    const result = [];
    const length = signal.length;
    let prev = signal[0];
    let prev_slope = 1.0;
    for (let i = 1; i < length; i++) {
        const cur = signal[i];
        const slope = cur - prev;
        if (cur < prev && prev_slope > 0.0 && cur > thresh) {
            result.push({index: i - 1, value: prev});
        }
        prev = cur;
        prev_slope = slope;
    }
    return result;
};
const filterMinLeft = (peaks, values, steps) => {
    let i = peaks.length;
    while (--i > -1) {
        const element = peaks[i];
        const index = element.index;
        let value = element.value;
        for (let j = 1; j <= steps; j++) {
            if (index - j < 0) {
                break;
            }
            const successor = values[index - j];
            if (successor > value) {
                peaks.splice(i, 1);
                break;
            }
            value = successor;
        }
    }
};
export const HueToRGB = (m1, m2, h) => {
    if (h < 0.0) {
        ++h;
    } else if (h > 1.0) {
        --h;
    }
    if (h * 6.0 < 1.0) {
        return m1 + (m2 - m1) * h * 6.0;
    } else if (h * 2.0 < 1.0) {
        return m2;
    } else {
        return h * 3.0 < 2.0 ? m1 + (m2 - m1) * (0.6666667 - h) * 6.0 : m1;
    }
};
export const hsla = (hue, saturation, lightness, alpha) => {
    if (hue > 1.0) hue = 1.0;
    else if (hue < 0.0) hue = 0.0;
    if (saturation > 1.0) saturation = 1.0;
    else if (saturation < 0.0) saturation = 0.0;
    if (lightness > 1.0) lightness = 1.0;
    else if (lightness < 0.0) lightness = 0.0;
    let r, g, b;
    let m2;
    let m1;
    if (lightness <= 0.5) {
        m2 = lightness * (saturation + 1.0);
    } else {
        m2 = lightness + saturation - lightness * saturation;
    }
    m1 = lightness * 2.0 - m2;
    r = Math.round(255.0 * HueToRGB(m1, m2, hue + (1.0 / 3.0)));
    g = Math.round(255.0 * HueToRGB(m1, m2, hue));
    b = Math.round(255.0 * HueToRGB(m1, m2, hue - (1.0 / 3.0)));
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
};
export const quadraticBezier = (p0, p1, p2, t) => {
    const omt = 1.0 - t;
    return p0 * omt * omt + p1 * 2.0 * omt * t + p2 * t * t;
};
export const replaceElement = (source, target) => {
    target.parentNode.replaceChild(source, target);
    for (let clazz of target.classList) {
        source.classList.add(clazz);
    }
};
export const emptyElement = element => {
    while (element.hasChildNodes()) {
        element.lastChild.remove();
    }
};
export const mouse = (element, onMouseDown, onMouseMove, onMouseUp) => {
    const mouseMove = event => onMouseMove(event);
    const mouseUp = event => {
        window.removeEventListener("mouseup", mouseUp);
        window.removeEventListener("mousemove", mouseMove);
        onMouseUp(event);
    };
    element.addEventListener("mousedown", event => {
        onMouseDown(event);
        window.addEventListener("mouseup", mouseUp);
        window.addEventListener("mousemove", mouseMove);
    });
};
// https://gist.githubusercontent.com/gordonbrander/2230317/raw/e949b99b2c52c0dfb3044b68e401111e307087fa/ID.js
export const uid = () => {
    return Math.random().toString(36).substr(2, 9);
};
// This version only load 65536 bytes. Let's use the old fashioned XMLHttpRequest for now.
/*export const readBinary = url => {
    return fetch(url, {
        headers: {"Content-Type": "application/octet-stream"}
    }).then(e => e.body.getReader().read().then(x => x.value.buffer));
};*/
export const readBinary = url => {
    return new Promise((resolve, reject) => {
        const r = new XMLHttpRequest();
        r.open("GET", url, true);
        r.responseType = "arraybuffer";
        r.onload = ignore => resolve(r.response);
        r.onerror = event => reject(event);
        r.send(null);
    });
};
export const readAudio = (context, url) => {
    return readBinary(url).then(buffer => decodeAudioData(context, buffer));
};
export const decodeAudioData = (context, buffer) => {
    return new Promise((resolve, reject) => {
        context.decodeAudioData(buffer, resolve, reject);
    });
};
export const fetchMicrophone = () => {
    return new Promise((resolve, reject) => {
        navigator.getUserMedia({audio: true},
            stream => resolve(stream),
            error => reject(error));
    });
};
export const encode32 = (buffer) => {
    const MAGIC_RIFF = 0x46464952;
    const MAGIC_WAVE = 0x45564157;
    const MAGIC_FMT = 0x20746d66;
    const MAGIC_DATA = 0x61746164;
    const bytesPerChannel = Float32Array.BYTES_PER_ELEMENT;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const size = 44 + numFrames * numberOfChannels * bytesPerChannel;
    const buf = new ArrayBuffer(size);
    const view = new DataView(buf);
    view.setUint32(0, MAGIC_RIFF, true);
    view.setUint32(4, size - 8, true);
    view.setUint32(8, MAGIC_WAVE, true);
    view.setUint32(12, MAGIC_FMT, true);
    view.setUint32(16, 16, true); // chunk length
    view.setUint16(20, 3, true); // compression
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * bytesPerChannel, true);
    view.setUint16(32, numberOfChannels * bytesPerChannel, true);
    view.setUint16(34, 8 * bytesPerChannel, true);
    view.setUint32(36, MAGIC_DATA, true);
    view.setUint32(40, numberOfChannels * numFrames * bytesPerChannel, true);
    const channels = [];
    for (let i = 0; i < numberOfChannels; ++i) {
        channels[i] = buffer.getChannelData(i);
    }
    let w = 44;
    for (let i = 0; i < numFrames; ++i) {
        for (let j = 0; j < numberOfChannels; ++j) {
            view.setFloat32(w, channels[j][i], true);
            w += bytesPerChannel;
        }
    }
    return view.buffer;
};
export const saveFile = (file, type, fileName) => {
    const blob = new Blob([file], {type: type});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
};
export const beep = (context, startTime, frequency) => {
    const duration = 0.050;
    const fadeTime = 0.010;
    const endTime = startTime + duration;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    oscillator.start(startTime);
    oscillator.stop(endTime);
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(startTime, 0.0);
    gainNode.gain.linearRampToValueAtTime(1.0, startTime + fadeTime);
    gainNode.gain.setValueAtTime(endTime - fadeTime, 1.0);
    gainNode.gain.linearRampToValueAtTime(0.0, endTime);
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
};
export const createRadioButton = (parent, name, checked, labelText, value) => {
    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "radio");
    checkbox.checked = checked;
    checkbox.name = name;
    checkbox.value = undefined === value ? labelText : value;
    const id = uid();
    checkbox.id = id;
    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = labelText;
    parent.appendChild(checkbox);
    parent.appendChild(label);
    return checkbox;
};
export const createRadioGroup = (form, name) => (checked, labelText, value) => createRadioButton(form, name, checked, labelText, value);
export const nextPow2 = v => {
    v += v === 0;
    --v;
    v |= v >>> 1;
    v |= v >>> 2;
    v |= v >>> 4;
    v |= v >>> 8;
    v |= v >>> 16;
    return v + 1;
};
// Creates a strictly monotone increasing number sequence from [0,1]
export const monotoneRandom = (sequence, depth) => {
    let sum = 0;
    for (let i = 1; i < sequence.length; ++i) {
        let random = Math.floor(Math.random() * depth) + 1;
        sequence[i] = random;
        sum += random;
    }
    let nominator = 0;
    for (let i = 1; i < sequence.length; ++i) {
        nominator += sequence[i];
        sequence[i] = nominator / sum;
    }
    return sequence;
};

export class TextMeasuring {
    constructor(font, size) {
        this.font = font;
        this.size = size;
        this.div = null;
    }

    measure(text) {
        const element = this.getOrCreateElement();
        element.style.font = this.font;
        element.style.fontSize = this.size + "px";
        element.style.whiteSpace = "nowrap";
        element.style.maxWidth = "initial";
        element.textContent = text;
        return {width: element.clientWidth, height: element.clientHeight};
    }

    getOrCreateElement() {
        if (null === this.div) {
            this.div = document.createElement("div");
            this.div.style.position = "absolute";
            this.div.style.width = "auto";
            this.div.style.height = "auto";
            this.div.style.visibility = "hidden";
            document.body.appendChild(this.div);
        }
        return this.div;
    }
}

export class Plot {
    constructor(width, height, padding, mapX, mapY) {
        this.width = width;
        this.height = height;
        this.padding = padding || new Float64Array(4); // t, r, b, l
        this.mapX = mapX || Linear.Identity;
        this.mapY = mapY || Linear.Identity;
    }

    get innerWidth() {
        return this.width - (this.padding[1] + this.padding[3]);
    }

    get innerHeight() {
        return this.height - (this.padding[0] + this.padding[2]);
    }

    valueToX(value) {
        return this.padding[3] + this.mapX.x(value) * this.innerWidth;
    }

    xToValue(x) {
        return this.mapX.y((x - this.padding[3]) / this.innerWidth);
    }

    valueToY(value) {
        const inner = this.innerHeight;
        return this.padding[0] + inner - this.mapY.x(value) * inner;
    }

    yToValue(y) {
        const inner = this.innerHeight;
        return this.mapY.y(-(y - this.padding[0] - inner) / inner);
    }

    clampX(x) {
        return clamp(this.padding[1], this.width - this.padding[3], x);
    }

    clampY(y) {
        return clamp(this.padding[0], this.height - this.padding[2], y);
    }
}