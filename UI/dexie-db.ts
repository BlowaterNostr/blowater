import * as dexie from "https://esm.sh/dexie@3.2.4";
import { NostrEvent, NostrKind, Tag } from "../lib/nostr-ts/nostr.ts";
import { EventsAdapter, Indices, RelayAdapter } from "../database.ts";

export type RelayRecord = {
    url: string;
    event_id: string;
};

export type RemovedRecords = {
    event_id: string;
    reason: string;
};

export class DexieDatabase extends dexie.Dexie implements EventsAdapter, RelayAdapter {
    // 'events' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    events!: dexie.Table<NostrEvent>;
    relayRecords!: dexie.Table<RelayRecord>;
    removedRecords!: dexie.Table<RemovedRecords>;

    constructor() {
        super("Events");
        this.version(19).stores({
            events: "&id, created_at, kind, tags, pubkey", // indices
            relayRecords: "[url+event_id]", // RelayRecord
            removedRecords: "&event_id, reason", // RemoveRecords
        });
    }
    async filter(f?: (e: NostrEvent) => boolean): Promise<NostrEvent[]> {
        return this.events.toArray();
    }
    async get(keys: Indices) {
        return this.events.get(keys);
    }
    async put(e: NostrEvent<NostrKind, Tag>): Promise<void> {
        await this.events.put(e);
    }
    async remove(id: string, reason?: string) {
        this.removedRecords.put({
            event_id: id,
            reason: reason || "",
        });
    }

    setRelayRecord = async (eventID: string, url: string): Promise<void> => {
        await this.relayRecords.put({
            url: url,
            event_id: eventID,
        });
    };

    getRelayRecord = async (eventID: string) => {
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
