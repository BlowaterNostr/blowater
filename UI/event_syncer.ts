import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { Database_Contextual_View } from "../database.ts";
import { NoteID } from "../lib/nostr-ts/nip19.ts";

export class EventSyncer {
    constructor(private readonly pool: ConnectionPool, private readonly db: Database_Contextual_View) {}

    syncEvent(id: NoteID) {
        const subID = EventSyncer.name + ":syncEvent";
        const e = this.db.get({ id: id.hex });
        if (e) {
            return e;
        }
        return (async () => {
            await this.pool.closeSub(subID);
            let events = await this.pool.newSub(subID, { ids: [id.hex] });
            if (events instanceof Error) {
                return events;
            }
            for await (const { res, url } of events.chan) {
                if (res.type != "EVENT") {
                    continue;
                }
                await this.db.addEvent(res.event);
                return; // just need to read from 1 relay
            }
        })();
    }
}
