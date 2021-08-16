// http://registeringdomainnamesismorefunthandoingrealwork.com/2009/04/euclidean-algorithmic-beat-generator/
// 0: None
// 1: Accent
// 2: Active (no accent)
import {ParameterBuilder} from "./parameter.js";
import {LinearInt, NoFloat} from "./mapping.js";

export class Euclidean {
    static render(steps, pulses, output) {
        const push = ((array) => {
            let index = 0;
            return value => array[index++] = value;
        })(output);
        if (pulses >= steps || steps === 1 || pulses === 0) {
            if (pulses >= steps) {
                for (let i = 0; i < steps; i++) {
                    push(1);
                }
            } else if (steps === 1) {
                if (pulses === 1) {
                    push(1);
                } else {
                    push(0);
                }
            } else {
                for (let i = 0; i < steps; i++) {
                    push(0);
                }
            }
        } else {
            const pauses = steps - pulses;
            if (pauses >= pulses) {
                const per_pulse = Math.floor(pauses / pulses);
                const remainder = pauses % pulses;
                for (let i = 0; i < pulses; i++) {
                    push(1);
                    for (let j = 0; j < per_pulse; j++) {
                        push(0);
                    }
                    if (i < remainder) {
                        push(0);
                    }
                }
            } else {
                const per_pause = Math.floor((pulses - pauses) / pauses);
                const remainder = (pulses - pauses) % pauses;
                for (let i = 0; i < pauses; i++) {
                    push(1);
                    push(0);
                    for (let j = 0; j < per_pause; j++) {
                        push(1);
                    }
                    if (i < remainder) {
                        push(1);
                    }
                }
            }
        }
    }

    constructor() {
        this.parameterSteps = ParameterBuilder.begin("Steps")
            .valueMapping(new LinearInt(1, 32))
            .printMapping(NoFloat)
            .unit("#")
            .value(16)
            .create();
        this.parameterPulses = ParameterBuilder.begin("Pulses")
            .valueMapping(new LinearInt(0, 32))
            .printMapping(NoFloat)
            .unit("#")
            .value(0)
            .create();
        this.parameterShift = ParameterBuilder.begin("Shift")
            .valueMapping(new LinearInt(-31, 31))
            .printMapping(NoFloat)
            .unit("#")
            .value(0)
            .create();
        this.pattern = new Uint8Array(32);

        const update = () => Euclidean.render(this.steps, this.pulses, this.pattern);
        update();

        this.parameterSteps.addCallback(ignore => update());
        this.parameterPulses.addCallback(ignore => update());
        this.parameterShift.addCallback(ignore => update());
    }

    get steps() {
        return this.parameterSteps.value;
    }

    get pulses() {
        return this.parameterPulses.value;
    }

    get shift() {
        return this.parameterShift.value;
    }

    getStepAt(index) {
        const unclamped = (index - this.shift) % this.steps;
        return this.pattern[0 > unclamped ? unclamped + this.steps : unclamped];
    }
}

export const apply_accents = (r, a) => {
    let offset = 0;
    const out = new Uint8Array(r.length);
    for (let b = 0; b < r.length; b++) {
        if (r[b] === 1) {
            if (a[offset] === 1) {
                out[b] = 1;
            } else {
                out[b] = 2;
            }
            offset += 1;
        } else {
            out[b] = 0;
        }
    }
    return out;
};