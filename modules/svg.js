export class SVG {
    static create(width, height) {
        const svg = document.createElementNS(SVG.NAME_SPACE, "svg");
        svg.setAttribute("version", "1.1");
        svg.setAttribute("viewBox", "0 0 " + width + " " + height);
        svg.style.width = width + "px";
        svg.style.height = height + "px";
        svg.style.userSelect = "none";
        svg.style.outline = "none";
        return svg;
    }

    static createElement(name, attributes) {
        const element = document.createElementNS(SVG.NAME_SPACE, name);
        if (attributes !== undefined) {
            for (let key in attributes) {
                element.setAttribute(key, attributes[key]);
            }
        }
        return element;
    }

    static rect(x, y, w, h, styles) {
        const element = this.createElement("rect");
        element.setAttribute("x", x);
        element.setAttribute("y", y);
        element.setAttribute("width", w);
        element.setAttribute("height", h);
        this.applyStyle(element, styles);
        return element;
    }

    static applyStyle(element, styles) {
        for (let key in styles) {
            element.style.setProperty(key, styles[key]);
        }
    }

    static circle(cx, cy, radius, attributes) {
        const element = this.createElement("circle", attributes);
        element.setAttribute("cx", cx);
        element.setAttribute("cy", cy);
        element.setAttribute("r", radius);
        return element;
    }

    static path(attributes) {
        return new SVGPathBuilder(this.createElement("path", attributes));
    }

    static text(x, y, text, attributes) {
        const element = this.createElement("text", attributes);
        element.setAttribute("x", x);
        element.setAttribute("y", y);
        element.setAttribute("text", text);
        element.textContent = text;
        return element;
    }
}

SVG.NAME_SPACE = "http://www.w3.org/2000/svg";

export class SVGPathBuilder {
    static get(element) {
        return new SVGPathBuilder(element);
    }

    constructor(element) {
        this.e = element;
        this.d = "";
    }

    moveTo(x, y) {
        this.d += "M" + x + " " + y;
        return this;
    }

    lineTo(x, y) {
        this.d += "L" + x + " " + y;
        return this;
    }

    ellipticalArc(rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y) {
        this.d += "A" + rx + " " + ry + " " + xAxisRotation + " " + largeArcFlag + " " + sweepFlag + " " + x + " " + y;
        return this;
    }

    circleSegment(cx, cy, radius, a0, a1) {
        const x0 = cx + Math.cos(a0) * radius;
        const y0 = cy + Math.sin(a0) * radius;
        const x1 = cx + Math.cos(a1) * radius;
        const y1 = cy + Math.sin(a1) * radius;
        let range = a1 - a0;
        while (range < 0.0) range += Math.PI * 2.0;
        return this.moveTo(x0, y0).ellipticalArc(radius, radius, 0, range > Math.PI ? 1 : 0, 1, x1, y1);
    }

    append(data) {
        this.d += data;
        return this;
    }

    complete() {
        this.e.setAttribute("d", this.d);
        this.d = "";
        return this.e;
    }
}