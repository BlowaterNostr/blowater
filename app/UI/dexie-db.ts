import { Dexie, Table } from "https://esm.sh/v135/dexie@3.2.4/dist/dexie.js";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { EventMark, EventMarker, EventRemover, EventsAdapter, Indices, RelayRecorder } from "../database.ts";
import { Tag } from "../nostr.ts";

export type RelayRecord = {
    url: string;
    event_id: string;
};

export class DexieDatabase extends Dexie implements EventsAdapter, RelayRecorder, EventMarker, EventRemover {
    // 'events' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    events!: Table<NostrEvent>;
    relayRecords!: Table<RelayRecord>;
    eventMarks!: Table<EventMark>;

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

    async setRelayRecord(eventID: string, url: string): Promise<void> {
        await this.relayRecords.put({
            url: url,
            event_id: eventID,
        });
    }

    getAllRelayRecords = async () => {
        const resMap = new Map<string, Set<string>>();
        for (const relay of await this.relayRecords.toArray()) {
            const records = resMap.get(relay.event_id);
            if (records) {
                records.add(relay.url);
            } else {
                resMap.set(relay.event_id, new Set([relay.url]));
            }
        }

        return resMap;
    };

    getMark(eventID: string): Promise<EventMark | undefined> {
        return this.eventMarks.get(eventID);
    }
    async markEvent(eventID: string, reason: "removed"): Promise<void> {
        await this.eventMarks.put({
            event_id: eventID,
            reason: reason,
        });
    }
    async getAllMarks(): Promise<EventMark[]> {
        return this.eventMarks.toArray();
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
