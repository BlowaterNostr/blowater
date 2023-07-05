import {
    ConnectionPool,
    newSubID,
    SubscriptionAlreadyExist,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { Database } from "../database.ts";
import { NoteID } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nip19.ts";
import { verifyEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

export class EventSyncer {
    constructor(private readonly pool: ConnectionPool, private readonly db: Database) {}
    syncEvent(id: NoteID) {
        const iter = Array.from(this.db.filterEvents((e) => e.id == id.hex));
        if (iter.length > 0) {
            return iter[0];
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
}
