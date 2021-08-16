import {ParameterBuilder} from "../modules/parameter.js";
import {Linear, Exp, OneFloat, TwoFloats, ThreeFloats, LinearInt, Level, NoFloat} from "../modules/mapping.js";
import {noiseGen} from "../workers/noise.js";

export class Drum extends AudioWorkletNode {
    constructor(context) {
        super(context, "drums");

        const onParameterChanged = p => {
        };

        this.channels = [
            {
                name: "Kick",
                parameters: [
                    this.createVolumeParameter(onParameterChanged, "kick/volume"),
                    ParameterBuilder.begin("Pitch Floor")
                        .valueMapping(new Exp(20.0, 200.0))
                        .printMapping(OneFloat)
                        .unit("Hz")
                        .value(40.0)
                        .callback(onParameterChanged)
                        .createShared(this.port, "kick/pitchFloor"),
                    ParameterBuilder.begin("Pitch Ceiling")
                        .valueMapping(new Linear(1.0, 8.0))
                        .printMapping(OneFloat)
                        .unit("*")
                        .value(5.0)
                        .callback(onParameterChanged)
                        .createShared(this.port, "kick/pitchBend"),
                    ParameterBuilder.begin("Pitch Time")
                        .valueMapping(new Exp(0.010, 1.000))
                        .printMapping(ThreeFloats)
                        .unit("sec")
                        .value(0.020)
                        .callback(onParameterChanged)
                        .createShared(this.port, "kick/pitchTime"),
                    ParameterBuilder.begin("Decay Time")
                        .valueMapping(new Linear(0.005, 3.000))
                        .printMapping(ThreeFloats)
                        .unit("sec")
                        .value(0.800)
                        .callback(onParameterChanged)
                        .createShared(this.port, "kick/decayTime"),
                    ParameterBuilder.begin("Attack Level")
                        .value(0.8)
                        .callback(onParameterChanged)
                        .createShared(this.port, "kick/attackLevel")
                ]
            },
            {
                name: "Clap",
                parameters: [
                    this.createVolumeParameter(onParameterChanged, "clap/volume"),
                    ParameterBuilder.begin("Decay")
                        .valueMapping(new Exp(0.016, 1.000))
                        .printMapping(ThreeFloats)
                        .unit("sec")
                        .value(0.060)
                        .callback(onParameterChanged)
                        .createShared(this.port, "clap/decay"),
                    ParameterBuilder.begin("Offset")
                        .valueMapping(new Linear(0.008, 0.024))
                        .printMapping(ThreeFloats)
                        .unit("sec")
                        .value(0.012)
                        .callback(onParameterChanged)
                        .createShared(this.port, "clap/offset"),
                    ParameterBuilder.begin("Freq")
                        .valueMapping(new Exp(400.0, 4000.0))
                        .printMapping(OneFloat)
                        .unit("Hz")
                        .value(1000.0)
                        .callback(onParameterChanged)
                        .createShared(this.port, "clap/frequency"),
                    ParameterBuilder.begin("BandWidth")
                        .valueMapping(new Exp(1000.0, 4000.0))
                        .printMapping(OneFloat)
                        .unit("Hz")
                        .value(2000.0)
                        .callback(onParameterChanged)
                        .createShared(this.port, "clap/bandwidth"),
                    ParameterBuilder.begin("Separation")
                        .valueMapping(new LinearInt(1.0, 4.0))
                        .printMapping(NoFloat)
                        .unit("#")
                        .value(2)
                        .callback(onParameterChanged)
                        .createShared(this.port, "clap/separation")
                ]
            },
            {
                name: "Cowbell",
                parameters: [
                    this.createVolumeParameter(onParameterChanged, "cowbell/volume"),
                    ParameterBuilder.begin("Decay")
                        .valueMapping(new Exp(50.0, 1000.0))
                        .printMapping(TwoFloats)
                        .unit("ms")
                        .value(100.0)
                        .callback(onParameterChanged)
                        .createShared(this.port, "cowbell/decay"),
                    ParameterBuilder.begin("Frequency")
                        .valueMapping(new Exp(240.0, 1000.0))
                        .printMapping(TwoFloats)
                        .unit("hz")
                        .value(558.0)
                        .callback(onParameterChanged)
                        .createShared(this.port, "cowbell/frequency")
                ]
            }
        ];

        noiseGen(0x12321, (nf) => 1.0).then(samples => this.port.postMessage({action: "noise", value: samples}));
    }

    createVolumeParameter(onParameterChanged, address) {
        return ParameterBuilder.begin("Volume")
            .valueMapping(Level.DEFAULT)
            .printMapping(OneFloat)
            .unit("db")
            .value(0.0)
            .callback(onParameterChanged)
            .createShared(this.port, address);
    }
}