import {
    NostrEvent,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { Tag } from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export const NotFound = Symbol("Not Found");
const buffer_size = 1000;
export interface Indices {
    readonly id?: string;
    readonly create_at?: number;
    readonly kind?: NostrKind;
    readonly tags?: Tag[];
    readonly pubkey?: string;
}

export class Database {
    private readonly sourceOfChange = csp.chan<NostrEvent>(buffer_size);
    private readonly caster = csp.multi<NostrEvent>(this.sourceOfChange);

    constructor(
        private addToIndexedDB: (event: NostrEvent) => Promise<void>,
        public getEvent: (keys: Indices) => Promise<NostrEvent | undefined>,
        public filterEvents: (
            filter: (e: NostrEvent) => boolean,
        ) => Iterable<NostrEvent>,
        public remove: (id: string) => Promise<void>,
    ) {}

    async addEvent(event: NostrEvent) {
        const storedEvent = await this.getEvent({ id: event.id });
        if (storedEvent) { // event exist
            return;
        }
        console.log("Database.addEvent", event.id);
        await this.addToIndexedDB(event);
        await this.sourceOfChange.put(event);
    }

    syncEvents(
        filter: (e: NostrEvent) => boolean,
        events: csp.Channel<{ event: NostrEvent; url: string /*relay url*/ }>,
    ): csp.Channel<NostrEvent> {
        const resChan = csp.chan<NostrEvent>(buffer_size);
        (async () => {
            for await (const { event, url } of events) {
                if (resChan.closed()) {
                    await events.close(
                        "db syncEvents, resChan is closed, closing the source events",
                    );
                    return;
                }
                if (filter(event)) {
                    await this.addEvent(event);
                } else {
                    console.log(
                        "event",
                        event,
                        "does not satisfy filterer",
                        filter,
                    );
                }
            }
            await resChan.close(
                "db syncEvents, source events is closed, closing the resChan",
            );
        })();
        return resChan;
    }

    //////////////////
    // On DB Change //
    //////////////////
    onChange(filter: (e: NostrEvent) => boolean) {
        const c = this.caster.copy();
        const res = csp.chan<NostrEvent>(buffer_size);
        (async () => {
            for await (const newE of c) {
                if (filter(newE)) {
                    const err = await res.put(newE);
                    if (err instanceof csp.PutToClosedChannelError) {
                        await c.close(
                            "onChange listern has been closed, closing the source",
                        );
                    }
                }
            }
            await res.close(
                "onChange source has been closed, closing the listener",
            );
        })();
        return res;
    }
}
