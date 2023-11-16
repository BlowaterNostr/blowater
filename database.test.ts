import { testEventsAdapter, testRelayAdapter } from "./UI/_setup.test.ts";
import { Datebase_View } from "./database.ts";
import { prepareNormalNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";
import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());

Deno.test("Database", async () => {
    const db = await Datebase_View.New(testEventsAdapter, testRelayAdapter);

    const stream = db.subscribe();
    const event_to_add = await prepareNormalNostrEvent(ctx, { kind: NostrKind.TEXT_NOTE, content: "1" });
    await db.addEvent(event_to_add);
    assertEquals(
        db.events.map((e): NostrEvent => {
            return {
                content: e.content,
                created_at: e.created_at,
                id: e.id,
                kind: e.kind,
                pubkey: e.pubkey,
                sig: e.sig,
                tags: e.tags,
            };
        }),
        [event_to_add],
    );

    const e = await stream.pop() as NostrEvent;
    assertEquals(
        {
            content: e.content,
            created_at: e.created_at,
            id: e.id,
            kind: e.kind,
            pubkey: e.pubkey,
            sig: e.sig,
            tags: e.tags,
        },
        event_to_add,
    );

    const stream2 = db.subscribe();

    await db.addEvent(event_to_add); //   add a duplicated event
    assertEquals(db.events.length, 1); // no changes

    const event_to_add2 = await prepareNormalNostrEvent(ctx, { kind: NostrKind.TEXT_NOTE, content: "2" });
    // console.log(event_to_add2.id, event_to_add.id)
    await db.addEvent(event_to_add2);
    const e2 = await stream.pop() as NostrEvent;
    assertEquals(e2, await stream2.pop() as NostrEvent);
    assertEquals({
        content: e2.content,
        created_at: e2.created_at,
        id: e2.id,
        kind: e2.kind,
        pubkey: e2.pubkey,
        sig: e2.sig,
        tags: e2.tags,
    }, event_to_add2);
});

Deno.test("Relay Record", async () => {
    const db = await Datebase_View.New(testEventsAdapter, testRelayAdapter);

    const stream = db.subscribe();
    let i = 0;
    (async function f() { // only twice
        for await (const _ of stream) {
            i++;
        }
    })();
    const event_to_add = await prepareNormalNostrEvent(ctx, { kind: NostrKind.TEXT_NOTE, content: "1" });
    const event_to_add_2 = await prepareNormalNostrEvent(ctx, { kind: NostrKind.TEXT_NOTE, content: "2" });
    await db.addEvent(event_to_add); // send by client
    assertEquals(await db.getRelayRecord(event_to_add.id), []);

    await db.addEvent(event_to_add_2, "wss://relay.blowater.app"); // receiver from relay
    assertEquals(await db.getRelayRecord(event_to_add_2.id), ["wss://relay.blowater.app"]);

    await db.addEvent(event_to_add_2, "wss://relay.test.app");
    assertEquals(await db.getRelayRecord(event_to_add_2.id), [
        "wss://relay.blowater.app",
        "wss://relay.test.app",
    ]);

    assertEquals(i, 2);
});
