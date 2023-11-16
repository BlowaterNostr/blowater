import * as dexie from "https://esm.sh/dexie@3.2.4";
import { NostrEvent, NostrKind, Tag } from "../lib/nostr-ts/nostr.ts";
import { EventsAdapter, Indices } from "../database.ts";

export type RelayTable = {
    url: string;
    event_id: string;
};

export class DexieDatabase extends dexie.Dexie implements EventsAdapter {
    // 'events' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    events!: dexie.Table<NostrEvent>;
    relays!: dexie.Table<RelayTable>;

    constructor() {
        super("Events");
        this.version(8).stores({
            events: "&id, created_at, kind, tags, pubkey", // indices
            relays: "[url+event_id]", // relayTable
        });
    }
    filter(f?: (e: NostrEvent) => boolean): Promise<NostrEvent[]> {
        return this.events.toArray();
    }
    get(keys: Indices) {
        return this.events.get(keys);
    }
    async put(e: NostrEvent<NostrKind, Tag>): Promise<void> {
        this.events.put(e);
    }
    async remove(id: string) {
        this.events.delete(id);
    }

    putRelay = async (eventID: string, url: string): Promise<void> => {
        this.relays.put({
            url: url,
            event_id: eventID,
        });
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
