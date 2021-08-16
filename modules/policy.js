export class Policy {
    static newAudioContext() {
        const context = new AudioContext();
        if (context.state === "suspended") {
            this.waitForUserInteraction(
                "Playback has been disabled by your browser. " +
                "Please click anywhere to resume.")
                .then(() => context.resume());
        }
        return context;
    }

    static playAudio(audio) {
        return audio.play()
            .catch(ignore => this.waitForUserInteraction("Click to Play Audio...")
                .then(() => this.playAudio(audio)));
    }

    static waitForUserInteraction(message) {
        return new Promise((resolve, ignore) => {
            const div = document.createElement("div");
            const ondown = ignore => {
                resolve();
                div.remove();
                window.removeEventListener("mousedown", ondown);
            };
            const onload = ignore => {
                div.className = "policy";
                div.textContent = message;
                document.body.appendChild(div);
                window.removeEventListener("load", onload);
                window.addEventListener("mousedown", ondown);
            };
            window.addEventListener("load", onload);
        });
    }
}