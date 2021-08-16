import {ParameterBuilder} from "../modules/parameter.js";
import {Level, Exp, OneFloat} from "../modules/mapping.js";

export class ClickSetting {
    static beginLevel() {
        return ParameterBuilder.begin("Level")
            .valueMapping(Level.DEFAULT)
            .printMapping(OneFloat)
            .unit("db")
            .value(-72.0);
    }

    static beginTune() {
        const mapping = new Exp(0.001, 0.0001);
        return ParameterBuilder.begin("Tune")
            .valueMapping(mapping)
            .value(mapping.y(0.5));
    }

    static port(port) {
        return new ClickSetting(
            ClickSetting.beginLevel().createShared(port, "level"),
            ClickSetting.beginTune().createShared(port, "tune")
        );
    }

    static withCallback(callback) {
        return new ClickSetting(
            ClickSetting.beginLevel().callback(callback).create(),
            ClickSetting.beginTune().callback(callback).create()
        );
    }

    constructor(level, tune) {
        this.level = level;
        this.tune = tune;
    }
}

export class Click extends AudioWorkletNode {
    constructor(context) {
        super(context, "click", {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [1],
            channelCount: 1,
            channelCountMode: "explicit",
            channelInterpretation: "speakers"
        });

        this.setting = ClickSetting.port(this.port);
    }

    copyFrom(setting) {
        this.setting.level.unipolar = setting.level.unipolar;
        this.setting.tune.unipolar = setting.tune.unipolar;
    }
}