export class Policy {
    static newAudioContext() {
        const context = new AudioContext();
        if (context.state === "suspended") {
            this.waitForUserInteraction(
                "Playback has been paused by your browser. " +
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
            const resume = () => {
                resolve();
                div.remove();
                window.removeEventListener("keydown", resume);
                window.removeEventListener("mousedown", resume);
            };
            const onload = ignore => {
                div.className = "policy";
                div.textContent = message;
                document.body.appendChild(div);
                window.removeEventListener("load", onload);
                window.addEventListener("keydown", resume);
                window.addEventListener("mousedown", resume);
            };
            window.addEventListener("load", onload);
        });
    }
}