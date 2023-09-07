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


Deno.test("Database", async () => {
    const db = await Database_Contextual_View.New(adapter, ctx);
    console.log(db.events)

    const changes = db.onChange();

    db.addEvent(await prepareNormalNostrEvent(ctx, 1, [], ""))

    const x = await changes.pop()
    // console.log(x)
})

function testEvent(c: string): NostrEvent {
    return {
        content: c,
        created_at: Date.now(),
        id: "",
        kind: NostrKind.CONTACTS,
        pubkey: "",
        sig: "",
        tags: []
    }
}
