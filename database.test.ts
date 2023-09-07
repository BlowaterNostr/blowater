import { Database_Contextual_View, EventsAdapter, Indices } from "./database.ts";
import { prepareNormalNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const adapter: EventsAdapter = {
    delete() {},
    filter: async (f) => {
        return [];
    },
    get: (keys: Indices) => {
        return prepareNormalNostrEvent(ctx, NostrKind.CONTACTS, [], "");
    },
    put: async (e: NostrEvent) => {
    },
};
const db = Database_Contextual_View.New(adapter, ctx);
