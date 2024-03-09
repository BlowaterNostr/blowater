import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { Datebase_View } from "../database.ts";

export class EventSyncer {
    constructor(private readonly pool: ConnectionPool, private readonly db: Datebase_View) {}

    async syncEvent(id: NoteID | string) {
        if (id instanceof NoteID) {
            id = id.hex;
        }
        const subID = EventSyncer.name + ":syncEvent";
        await this.pool.closeSub(subID);
        let events = await this.pool.newSub(subID, { ids: [id] });
        if (events instanceof Error) {
            return events;
        }
        for await (const { res, url } of events.chan) {
            if (res.type != "EVENT") {
                continue;
            }
            await this.db.addEvent(res.event, url);
            return; // just need to read from 1 relay
        }
    }
}
