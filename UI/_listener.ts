import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export class Listener {
    static installPromptListener = new Channel<Event | undefined>();

    static init() {
        window.addEventListener("beforeinstallprompt", async (event) => {
            event.preventDefault();
            await this.installPromptListener.put(event);
        });
    }
}
