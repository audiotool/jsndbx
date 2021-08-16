class SharedParameter {
    constructor(callback, value) {
        this.callback = callback;
        this.value = value;
    }

    update(value) {
        if (this.value === value) {
            return;
        }
        this.value = value;
        if (undefined !== this.callback) {
            this.callback(this.value);
        }
    }
}

export class AbstractAudioWorkletProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super(options);

        this.parameterMap = {};

        this.port.onmessage = event => {
            const data = event.data;
            const action = data.action;
            const value = data.value;
            switch (action) {
                case "updateParameter": {
                    const parameter = this.parameterMap[value.id];
                    if (undefined === parameter) {
                        console.warn( value.id, "has not been defined in processor." );
                    }
                    parameter.update(value.value);
                    break;
                }
                default: {
                    this.processMessage(data);
                    break;
                }
            }
        };
    }

    processMessage(data) {
        return false;
    }

    bindParameter(id, callback) {
        return this.parameterMap[id] = new SharedParameter(callback);
    }
}