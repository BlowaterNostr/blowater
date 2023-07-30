import {
    ConnectionPool,
    SubscriptionAlreadyExist,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { Database_Contextual_View } from "../database.ts";
import { NoteID } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nip19.ts";
import { verifyEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

export class EventSyncer {
    constructor(private readonly pool: ConnectionPool, private readonly db: Database_Contextual_View) {}

    syncEvent(id: NoteID) {
        for (const e of this.db.events) {
            if (e.id == id.hex) {
                return e;
            }
        }
        return (async () => {
            let events = await this.pool.newSub("EventSyncer", {
                ids: [id.hex],
            });
            if (events instanceof SubscriptionAlreadyExist) {
                events = await this.pool.updateSub("EventSyncer", {
                    ids: [id.hex],
                });
            }
            if (events instanceof Error) {
                return events;
            }
            for await (const { res, url } of events) {
                if (res.type == "EOSE") {
                    continue;
                }
                const ok = await verifyEvent(res.event);
                if (!ok) {
                    console.warn(res.event, url, "not valid");
                    continue;
                }
                await this.db.addEvent(res.event);
                return; // just need to read from 1 relay
            }
        })();
    }

    // todo
    syncSocial() {
    }
}
