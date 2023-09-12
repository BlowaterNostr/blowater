import * as dexie from "https://esm.sh/dexie@3.2.4";
import { NostrEvent, NostrKind, Tag } from "../lib/nostr-ts/nostr.ts";
import { EventsAdapter, Indices } from "../database.ts";

export class DexieDatabase extends dexie.Dexie implements EventsAdapter {
    // 'events' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    events!: dexie.Table<NostrEvent>;

    constructor() {
        super("Events");
        this.version(6).stores({
            events: "&id, created_at, kind, tags, pubkey", // indices
        });
    }
    filter(f: (e: NostrEvent) => boolean): Promise<NostrEvent[]> {
        return this.events.filter(f).toArray();
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
}

export function NewIndexedDB(): DexieDatabase | Error {
    try {
        const db = new DexieDatabase();
        return db;
    } catch (e) {
        return e;
    }
}
