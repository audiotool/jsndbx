importScripts("../lib/pad.js");

this.pad = null;

onmessage = event => {
    const data = event.data;
    const action = data.action;
    const value = data.value;
    if (action === 'init') {
        this.pad = new Pad(value.fftSize, value.sampleRate, value.frequencies);
    } else if (null !== pad && action === 'update') {
        postMessage(this.pad.update(value));
    }
};