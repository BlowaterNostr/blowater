import * as dexie from "https://esm.sh/dexie@3.2.4";
import { NostrEvent, NostrKind, Tag } from "../lib/nostr-ts/nostr.ts";
import { EventsAdapter, Indices, RelayAdapter } from "../database.ts";

export type RelayRecord = {
    url: string;
    event_id: string;
};

export class DexieDatabase extends dexie.Dexie implements EventsAdapter, RelayAdapter {
    // 'events' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    events!: dexie.Table<NostrEvent>;
    relayRecords!: dexie.Table<RelayRecord>;

    constructor() {
        super("Events");
        this.version(9).stores({
            events: "&id, created_at, kind, tags, pubkey", // indices
            relayRecords: "[url+event_id]", // relayTable
        });
    }
    filter(f?: (e: NostrEvent) => boolean): Promise<NostrEvent[]> {
        return this.events.toArray();
    }
    get(keys: Indices) {
        return this.events.get(keys);
    }
    async put(e: NostrEvent<NostrKind, Tag>): Promise<void> {
        await this.events.put(e);
    }
    async remove(id: string) {
        return this.events.delete(id);
    }

    relayRecordSetter = async (eventID: string, url: string): Promise<void> => {
        await this.relayRecords.put({
            url: url,
            event_id: eventID,
        });
    };

    relayRecordGetter = async (eventID: string) => {
        return (await this.relayRecords.filter((relay) => relay.event_id == eventID).toArray()).map((relay) =>
            relay.url
        );
    };
}

export function NewIndexedDB(): DexieDatabase | Error {
    try {
        const db = new DexieDatabase();
        return db;
    } catch (e) {
        return e;
    }
}
