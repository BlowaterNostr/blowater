import { Datebase_View, EventMark, EventMarker, EventsAdapter, Indices, RelayRecorder } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { RelayRecord } from "./dexie-db.ts";

export const testEventBus = new EventBus<UI_Interaction_Event>();

export async function test_db_view() {
    const data = new Map();
    const testEventsAdapter: EventsAdapter = {
        filter: async (f) => {
            const events = [];
            for (const [k, v] of data) {
                events.push(v);
            }
            return events;
        },
        get: async (keys: Indices) => {
            return data.get(keys.id);
        },
        put: async (e: NostrEvent) => {
            data.set(e.id, e);
        },
    };

    const relays = new Map<string, Set<string>>();
    const testRelayRecorder: RelayRecorder = {
        setRelayRecord: async (eventID: string, url: string) => {
            const old = relays.get(eventID);
            if (old) {
                old.add(url);
            } else {
                relays.set(eventID, new Set([url]));
            }
        },
        getRelayRecord: (eventID: string) => {
            const res = relays.get(eventID);
            if (res == undefined) {
                return new Set();
            }
            return res;
        },
        getAllRelayRecords: async () => {
            return relays;
        },
    };

    const marks = new Map<string, EventMark>();
    const testEventMarker: EventMarker = {
        getMark: async (eventID: string) => {
            return marks.get(eventID);
        },
        async markEvent(eventID: string, reason: "removed") {
            marks.set(eventID, {
                event_id: eventID,
                reason: reason,
            });
        },
        async getAllMarks() {
            return Array.from(marks.values());
        },
    };
    return await Datebase_View.New(testEventsAdapter, testRelayRecorder, testEventMarker);
}
