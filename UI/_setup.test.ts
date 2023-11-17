import { EventsAdapter, Indices, RelayAdapter, RemovedAdapter } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { RemovedRecords } from "./dexie-db.ts";

export const testEventBus = new EventBus<UI_Interaction_Event>();
export const data = new Map();
export const relays = new Map<string, string[]>();
export const removed = new Map<string, RemovedRecords>();
export const testEventsAdapter: EventsAdapter = {
    async remove(id: string) {
        data.delete(id);
        removed.set(id, {
            event_id: id,
            reason: "",
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

export const testRelayAdapter: RelayAdapter = {
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

export const testRemovedAdapter: RemovedAdapter = {
    getRemovedRecord: async (eventID: string) => {
        return removed.get(eventID);
    },
};
