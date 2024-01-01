import { NostrEvent } from "../libs/nostr.ts/nostr.ts";
import { getTags } from "./nostr.ts";

export class LamportTime {
    private time = 0;

    fromEvents(events: Iterable<NostrEvent>) {
        for (const event of events) {
            const ts = getTags(event).lamport_timestamp;
            if (ts) {
                this.set(ts);
            }
        }
    }

    now() {
        this.time++;
        return this.time;
    }
    set(t: number) {
        this.time = Math.max(this.time, t);
    }
}
