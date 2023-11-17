import * as dexie from "https://esm.sh/dexie@3.2.4";
import { NostrEvent, NostrKind, Tag } from "../lib/nostr-ts/nostr.ts";
import { EventMarker, EventsAdapter, Indices, RelayRecorder } from "../database.ts";

export type RelayRecord = {
    url: string;
    event_id: string;
};

export type EventMark = {
    event_id: string;
    reason: "removed";
};

export class DexieDatabase extends dexie.Dexie implements EventsAdapter, RelayRecorder, EventMarker {
    // 'events' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    events!: dexie.Table<NostrEvent>;
    relayRecords!: dexie.Table<RelayRecord>;
    eventMarks!: dexie.Table<EventMark>;

    constructor() {
        super("Events");
        this.version(20).stores({
            events: "&id, created_at, kind, tags, pubkey", // indices
            relayRecords: "[url+event_id]", // RelayRecord
            eventMarks: "&event_id, reason", // RemoveRecords
        });
    }

    filter(f?: (e: NostrEvent) => boolean): Promise<NostrEvent[]> {
        return this.events.toArray();
    }
    async get(keys: Indices) {
        return this.events.get(keys);
    }
    async put(e: NostrEvent<NostrKind, Tag>): Promise<void> {
        await this.events.put(e);
    }
    async remove(id: string) {
        return this.markEvent(id, "removed");
    }

    setRelayRecord = async (eventID: string, url: string): Promise<void> => {
        await this.relayRecords.put({
            url: url,
            event_id: eventID,
        });
    };

    async getRelayRecord(eventID: string): Promise<string[]> {
        const array = await this.relayRecords.where("event_id").equals(eventID).toArray();
        return array.map((record) => record.url);
    }

    getMark(eventID: string): Promise<EventMark | undefined> {
        return this.eventMarks.get(eventID);
    }
    markEvent(eventID: string, reason: "removed"): Promise<void> {
        throw new Error("Method not implemented.");
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
