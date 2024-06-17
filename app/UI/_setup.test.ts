import { Database_View, EventMark, EventMarker, EventsAdapter, Indices, RelayRecorder } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { NostrEvent } from "../../libs/nostr.ts/nostr.ts";
import { UI_Interaction_Event } from "./app_update.tsx";

export const testEventBus = new EventBus<UI_Interaction_Event>();

export async function test_db_view() {
    const data = new Map();
    const testEventsAdapter: EventsAdapter = {
        filter: async () => {
            const events = [];
            for (const v of data.values()) {
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
            const records = relays.get(eventID);
            if (records) {
                records.add(url);
            } else {
                relays.set(eventID, new Set([url]));
            }
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
    return await Database_View.New(testEventsAdapter, testRelayRecorder, testEventMarker);
}
