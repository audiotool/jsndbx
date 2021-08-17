const listInstruments = (fileName, instruments) => {
    const select = document.querySelector("#input-sources");
    const list = document.createElement("optgroup");
    list.label = `SF: ${fileName}`;
    for (let i = 0; i < instruments.length; i++) {
        const instrument = instruments[i];
        const numBytes = instrument.zones.reduce((n, zone) => zone.sample.data.byteLength + n, 0);
        const name = instrument.header.name;
        console.log(`${i}: ${name} > ${numBytes >> 10}kb`);

        const option = document.createElement("option");
        option.textContent = `${name} (${numBytes >> 10}kb)`;
        list.appendChild(option);
    }
    select.appendChild(list);
};

document.querySelector("#input-soundfont-file").oninput = event => {
    const target = event?.target;
    if (target === undefined) return;
    const files = target?.files;
    if (files === undefined || files.length === 0) return;
    const file = files[0];
    const fileReader = new FileReader();
    const complete = sf => {
        target.value = null;
        if (null === sf) {
            alert(`${file.name} could not be imported.`);
        } else {
            alert(`${file.name} successfully imported.`);
            listInstruments(file.name, sf.instruments);
        }
    };
    fileReader.onload = () => {
        try {
            complete(SoundFont2.SoundFont2.from(new Uint8Array(fileReader.result)));
        } catch (e) {
            console.warn(e);
            complete(null);
        }
    };
    fileReader.onerror = () => complete(null);
    fileReader.readAsArrayBuffer(file);
}