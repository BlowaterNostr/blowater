import { EventMarker, EventsAdapter, Indices, RelayRecorder } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { EventMark } from "./dexie-db.ts";

export const testEventBus = new EventBus<UI_Interaction_Event>();

const data = new Map();
export const testEventsAdapter: EventsAdapter = {
    async remove(id: string) {
        data.delete(id);
        marks.set(id, {
            event_id: id,
            reason: "removed",
        });
    },
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

const relays = new Map<string, string[]>();
export const testRelayAdapter: RelayRecorder = {
    setRelayRecord: async (eventID: string, url: string) => {
        const oldURLs = relays.get(eventID);
        if (oldURLs) {
            oldURLs.push(url);
        } else {
            relays.set(eventID, [url]);
        }
    },
    getRelayRecord: async (eventID: string) => {
        const res = relays.get(eventID);
        return res ? res : [];
    },
};

const marks = new Map<string, EventMark>();
export const testEventMarker: EventMarker = {
    getMark: async (eventID: string) => {
        return marks.get(eventID);
    },
    async markEvent() {
    },
};
