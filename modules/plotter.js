import {Linear} from "./mapping.js";

export class ArrayPlotter {
    static render(context, values, x0, x1, y0, y1, s0, s1, yMin, yMax, modIndex) {
        const samplesEachPixel = (s1 - s0) / (x1 - x0);
        if (samplesEachPixel >= 1.0) {
            ArrayPlotter.renderOversampled(context, values, x0, x1, y0, y1, s0, s1, yMin, yMax);
        } else {
            ArrayPlotter.renderLines(context, values, x0, x1, y0, y1, s0, s1, yMin, yMax, modIndex);
        }
    }

    static renderOversampled(context, values, x0, x1, y0, y1, s0, s1, minValue, maxValue) {
        const samplesEachPixel = (s1 - s0) / (x1 - x0);
        const scale = (y1 - y0 - 1) / (maxValue - minValue);
        const pixelOverFlow = x0 - Math.floor(x0);
        let from = s0 - pixelOverFlow * samplesEachPixel;
        let indexFrom = from | 0;
        let min = Number.MAX_VALUE;
        let max = -Number.MAX_VALUE;
        for (let x = x0 | 0; x < x1; ++x) {
            const to = from + samplesEachPixel;
            const indexTo = to | 0;
            while (indexFrom < indexTo) {
                const value = values[indexFrom++];
                if (min > value) {
                    min = value;
                }
                if (max < value) {
                    max = value;
                }
            }
            const yMin = y0 + Math.floor((min - minValue) * scale);
            const yMax = y0 + Math.floor((max - minValue) * scale);
            // if( x === x0) {
            //     context.moveTo(x, yMin);
            // } else {
            //     context.lineTo(x, yMax);
            // }
            context.fillRect(x, yMin, 1, yMin === yMax ? 1 : yMax - yMin);
            const tmp = max;
            max = min;
            min = tmp;
            from = to;
            indexFrom = indexTo;
        }
    }

    static renderLines(context, values, x0, x1, y0, y1, s0, s1, minValue, maxValue, modIndex) {
        const pixelsEachSample = (x1 - x0) / (s1 - s0);
        const scale = (y1 - y0 - 1) / (maxValue - minValue);
        let s = s0;
        let penX = Math.round((Math.floor(s) - s0) * pixelsEachSample + x0);
        let penY = y0 + Math.round((values[Math.floor(s)] - minValue) * scale);
        context.moveTo(penX, penY);
        context.fillRect(penX - 1, penY - 1, 3, 3);
        s += 1.0;
        const sMax = Math.ceil(s1) + (modIndex ? 2 : 1);
        const mod = modIndex ? values.length : 0xFFFFFFFF;
        while (s <= sMax) {
            const sInt = Math.floor(s);
            const x = Math.round((sInt - s0) * pixelsEachSample + x0);
            const y = y0 + Math.round((values[sInt % mod] - minValue) * scale);
            context.lineTo(x, y);
            context.fillRect(x - 1, y - 1, 3, 3);
            penX = x;
            penY = y;
            s += 1.0;
        }
    }
}

export class PlotterRange {
    constructor(width, mapping) {
        this.$start = 0.0;
        this.$end = 1.0;
        this.$width = 0.0;
        this.$mapping = mapping;
        this.$minimum = 0.0;
        this.ZOOM_PADDING = 32.0;
        this.$observers = [];
        this.width = width;
    }

    addObserver(observer) {
        this.$observers.push(observer);
    }

    get start() {
        return this.$start;
    }

    get end() {
        return this.$end;
    }

    get width() {
        return this.$width;
    }

    set width(value) {
        if (this.$width === value) {
            return;
        }
        this.$width = value;
        this.updateMinimal();
        this.dispatch();
    }

    get frameStart() {
        return this.$mapping.y(this.$start);
    }

    get frameEnd() {
        return this.$mapping.y(this.$end);
    }

    frameOverlaps(start, complete) {
        return complete > this.frameStart && start < this.frameEnd;
    }

    moveTo(value) {
        let delta = value - this.$start;
        if (this.$start + delta < 0.0)
            delta = -this.$start;
        else if (this.$end + delta > 1.0)
            delta = 1.0 - this.$end;
        this.set(this.$start + delta, this.$end + delta);
    }

    setLeft(value) {
        let min;
        if (value < 0.0)
            min = 0.0;
        else if (value + this.$minimum > end)
            min = this.$end - this.$minimum;
        else
            min = value;
        this.set(min, this.$end);
    }

    setRight(value) {
        let max;
        if (value > 1.0)
            max = 1.0;
        else if (value < this.$start + this.$minimum)
            max = this.$start + this.$minimum;
        else
            max = value;
        this.set(this.$start, max);
    }

    setCenter(value) {
        const range = this.$end - this.$start;
        const rangeHalf = range / 2.0;
        let min = value - rangeHalf;
        let max = value + rangeHalf;
        if (0.0 > min) {
            min = 0.0;
            max = range;
        }
        if (1.0 < max) {
            min = 1.0 - range;
            max = 1.0;
        }
        this.set(min, max);
    }

    scaleAt(scale, position) {
        if (0.0 === scale) {
            return;
        }
        const range = this.$end - this.$start;
        const s = this.$start + (this.$start - position) * scale;
        const e = this.$end + (this.$end - position) * scale;
        if (0.0 < scale) {
            if (s < 0.0) {
                this.set(0.0, range * Math.pow(2.0, scale));
            }
            else if (e > 1.0) {
                this.set(1.0 - range * Math.pow(2.0, scale), 1.0);
            }
            else {
                this.set(s, e);
            }
        } else if (e - s < this.$minimum) {
            const ratio = (this.$minimum - range) / range;
            this.set(this.$start + (this.$start - position) * ratio, this.$end + (this.$end - position) * ratio);
        } else {
            this.set(s, e);
        }
    }

    showAll() {
        this.set(0.0, 1.0);
    }

    xToNorm(x) {
        return this.$start + x / this.$width * (this.$end - this.$start);
    }

    xToIndex(x) {
        return this.$mapping.y(this.$start + x / this.$width * (this.$end - this.$start));
    }

    normToX(value) {
        return (value - this.$start) / (this.$end - this.$start) * this.$width;
    }

    normToIndex(value) {
        return this.$mapping.y(value * (this.$end - this.$start) + this.$start);
    }

    indexToNorm(index) {
        return (this.$mapping.x(index) - this.$start) / (this.$end - this.$start);
    }

    indexToX(index) {
        return (this.$mapping.x(index) - this.$start) / (this.$end - this.$start) * this.$width;
    }

    unitsPerPixel() {
        return (this.$end - this.$start) * (this.$mapping.y(1.0) - this.$mapping.y(0.0)) / this.$width;
    }

    moveBy(delta) {
        if (this.$start + delta < 0.0)
            delta = -this.$start;
        if (this.$end + delta > 1.0)
            delta = 1.0 - this.$end;
        this.set(this.$start + delta, this.$end + delta);
    }

    scroll(pixel) {
        if (0.0 === pixel) {
            return;
        }
        const ratio = this.unitsPerPixel();
        this.moveBy(this.$mapping.x(pixel) * ratio);
    }

    showFrameInterval(min, max) {
        const framesPerPixel = (max - min) / (this.$width - this.ZOOM_PADDING * 2);
        const center = this.$mapping.x((min + max) >> 1);
        const range = Math.max(this.$minimum, this.$mapping.x(framesPerPixel * this.$width) * 0.5);
        this.set(center - range, center + range);
    }

    set(newStart, newEnd) {
        const clampStart = Math.max(0.0, newStart);
        const clampEnd = Math.min(1.0, newEnd);
        if (this.$start !== clampStart || this.$end !== clampEnd) {
            this.$start = clampStart;
            this.$end = clampEnd;
            this.dispatch();
        }
    }

    updateMinimal() {
        // TODO Easy for linear but exponential?
        const total = this.$mapping.y(1) - this.$mapping.y(0);
        this.$minimum = (this.$width / total) / this.$width; // works for ZynDisplay only now
    }

    dispatch() {
        for (let i = 0; i < this.$observers.length; ++i) {
            this.$observers[i](this);
        }
    }
}

export class PlotterRangeEvents {
    static attach(element, range) {
        PlotterRangeEvents.beginPointer = 0.0;
        PlotterRangeEvents.beginValue = 0.0;
        const onMouseMove = event => {
            range.moveTo(PlotterRangeEvents.beginValue - (event.clientX - PlotterRangeEvents.beginPointer) *
                (range.end - range.start) / range.width);
        };
        const onMouseUp = ignore => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        };
        const onMouseDown = event => {
            if (event.shiftKey) {
                return;
            }
            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
            PlotterRangeEvents.beginPointer = event.clientX;
            PlotterRangeEvents.beginValue = range.start;
        };

        element.addEventListener("mousedown", onMouseDown);
        element.addEventListener("wheel", event => {
            const WHEEL_SCALE_RATIO = 1.0 / 1024.0;
            const clientRect = element.getBoundingClientRect();
            range.scaleAt(event.deltaY * WHEEL_SCALE_RATIO, range.xToNorm(event.clientX - clientRect.left));
        }, true);
    }
}

export class PlotterCanvas {
    constructor() {
        this.root = document.createElement("div");
        this.root.style.width = "100%";
        this.root.style.height = "100%";
        this.root.style.position = "relative";
        this.root.style.background = "linear-gradient(rgb(30,30,30), rgb(36,36,36), rgb(20,20,20))";
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.canvas.style.position = "absolute";
        this.cursor = document.createElement("div");
        this.cursor.style.visibility = "hidden";
        this.cursor.style.width = "1px";
        this.cursor.style.height = "100%";
        this.cursor.style.position = "absolute";
        this.cursor.style.backgroundColor = "#28E5FF";
        this.context = this.canvas.getContext("2d");
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        this.devicePixelRatio = window.devicePixelRatio;
        this.mapping = new Linear(0, 1);
        this.range = new PlotterRange(1, this.mapping);
        this.range.addObserver(ignore => this.update());
        this.array = null;
        this.root.appendChild(this.canvas);
        this.root.appendChild(this.cursor);
        this.yMin = 1.0;
        this.yMax = -1.0;
        this.hasChanges = false;
        this.markers = [];
        this.color = "#EEE";
        this.modIndex = false;
        const update = _ => {
            if (
                this.hasChanges ||
                this.width !== this.root.clientWidth ||
                this.height !== this.root.clientHeight ||
                this.devicePixelRatio !== window.devicePixelRatio) {
                this.range.width = this.width = this.root.clientWidth;
                this.height = this.root.clientHeight;
                this.devicePixelRatio = window.devicePixelRatio;
                this.canvas.width = this.root.clientWidth * window.devicePixelRatio;
                this.canvas.height = this.root.clientHeight * window.devicePixelRatio;
                this.update();
            }
            window.requestAnimationFrame(update);
        };
        window.requestAnimationFrame(update);
    }

    makeInteractive() {
        PlotterRangeEvents.attach(this.canvas, this.range);
    }

    get domElement() {
        return this.root;
    }

    setWaveform(array) {
        this.mapping.max = array.length;
        this.range.updateMinimal();
        this.array = array;
        this.hasChanges = true;
    }

    setCursor(frame) {
        if (isNaN(frame)) {
            this.cursor.style.visibility = "hidden";
        } else {
            const x = Math.round(this.range.indexToX(frame));
            if (0 <= x && x < this.width) {
                this.cursor.style.left = x + "px";
                this.cursor.style.visibility = "visible";
            } else {
                this.cursor.style.visibility = "hidden";
            }
        }
    }

    addMarker(index) {
        this.markers.push(index);
        this.hasChanges = true;
    }

    clearMarkers() {
        if (0 < this.markers.length) {
            this.markers.splice(0, this.markers.length);
            this.hasChanges = true;
        }
    }

    removeMarkers(from, to) {
        const markers = this.markers;
        let index = markers.length;
        let changed = false;
        while (--index > -1) {
            const marker = markers[index];
            if (from < marker && marker < to) {
                changed = true;
                markers.splice(index, 1);
            }
        }
        if (changed) {
            this.hasChanges = true;
        }
    }

    setYRange(min, max) {
        this.yMin = min;
        this.yMax = max;
        this.hasChanges = true;
    }

    update() {
        this.hasChanges = false;
        const array = this.array;
        const context = this.context;
        const range = this.range;
        context.save();
        const pixelRatio = window.devicePixelRatio;
        context.scale(pixelRatio, pixelRatio);
        context.clearRect(0, 0, this.width, this.height);
        if (null === array) {
            return;
        }
        context.fillStyle = this.color;
        context.strokeStyle = this.color;
        context.beginPath();
        ArrayPlotter
            .render(context, array, 0, this.width, 0, this.height,
                range.frameStart, range.frameEnd, this.yMin, this.yMax, this.modIndex);
        context.stroke();

        context.beginPath();
        context.strokeStyle = "yellow";
        for (let i = 0; i < this.markers.length; i++) {
            const x = range.indexToX(this.markers[i]) + 0.5;
            context.moveTo(x, 0);
            context.lineTo(x, this.height);
        }
        context.stroke();
        context.restore();
    }
}