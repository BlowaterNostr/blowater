import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { Database } from "../database.ts";
import { NoteID } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nip19.ts";
import { verifyEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

export class EventSyncer {
    constructor(readonly pool: ConnectionPool, readonly db: Database) {}
    async syncEvent(id: NoteID) {
        const events = await this.pool.newSub("EventSyncer", {
            "#e": [id.hex],
        });
        if (events instanceof Error) {
            return events;
        }
        for await (const { res, url } of events) {
            if (res.type == "EOSE") {
                return;
            }
            const ok = await verifyEvent(res.event);
            if (!ok) {
                console.warn(res.event, url, "not valid");
            }
            await this.db.addEvent(res.event);
            return; // just need to read from 1 relay
        }
    }
}
