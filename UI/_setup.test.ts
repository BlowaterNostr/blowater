import { EventsAdapter, Indices } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { RelayAdder } from "./relay-config.ts";

export const testEventBus = new EventBus<UI_Interaction_Event>();
export const data = new Map();
export const testEventsAdapter: EventsAdapter = {
    async remove() {},
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
export const fakeRelayAdder: RelayAdder = { addRelayURL: async (_: string) => {} };
