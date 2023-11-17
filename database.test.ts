import { not_cancelled, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { testEventsAdapter, testRelayAdapter, testRemovedAdapter } from "./UI/_setup.test.ts";
import { Datebase_View } from "./database.ts";
import { prepareNormalNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";
import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";

Deno.test("Database", async () => {
    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const db = await Datebase_View.New(testEventsAdapter, testRelayAdapter, testRemovedAdapter);

    const stream = db.subscribe();
    const event_to_add = await prepareNormalNostrEvent(ctx, { kind: NostrKind.TEXT_NOTE, content: "1" });
    await db.addEvent(event_to_add);
    const e1 = db.get({ id: event_to_add.id });
    if (!e1) {
        fail();
    }
    assertEquals(
        {
            content: e1.content,
            created_at: e1.created_at,
            id: e1.id,
            kind: e1.kind,
            pubkey: e1.pubkey,
            sig: e1.sig,
            tags: e1.tags,
        },
        event_to_add,
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
    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const db = await Datebase_View.New(testEventsAdapter, testRelayAdapter, testRemovedAdapter);

    const stream = db.subscribe();
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

    await stream.pop();
    await stream.pop();

    const isCanceled = await sleep(10, stream.pop());
    assertEquals(isCanceled, not_cancelled);
});

Deno.test("mark remove event", async () => {
    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const db = await Datebase_View.New(testEventsAdapter, testRelayAdapter, testRemovedAdapter);
    const event_to_add = await prepareNormalNostrEvent(ctx, { kind: NostrKind.TEXT_NOTE, content: "1" });

    await db.addEvent(event_to_add);
    const e = db.get({ id: event_to_add.id });
    if (!e) {
        fail();
    }
    assertEquals({
        content: e.content,
        created_at: e.created_at,
        id: e.id,
        kind: e.kind,
        pubkey: e.pubkey,
        sig: e.sig,
        tags: e.tags,
    }, event_to_add);

    await db.remove(event_to_add.id);
    const e2 = db.get({ id: event_to_add.id });
    assertEquals(e2, undefined);

    await db.addEvent(event_to_add);
    const e3 = db.get({ id: event_to_add.id });
    assertEquals(e3, undefined);
});
