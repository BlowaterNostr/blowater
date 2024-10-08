import {
    InMemoryAccountContext,
    NostrEvent,
    NostrKind,
    prepareNostrEvent,
    PrivateKey,
} from "@blowater/nostr-sdk";
import { test_db_view } from "./UI/_setup.test.ts";
import { Parsed_Event } from "./nostr.ts";
import { assertEquals } from "https://deno.land/std@0.202.0/assert/assert_equals.ts";
import { fail } from "https://deno.land/std@0.202.0/assert/fail.ts";
import { ValueSet } from "@blowater/collections";
import { url_identity } from "./UI/_helper.ts";

Deno.test("Database", async () => {
    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const db = await test_db_view();

    const stream = db.subscribe();
    const event_to_add = await prepareNostrEvent(ctx, {
        kind: NostrKind.TEXT_NOTE,
        content: "1",
    }) as NostrEvent;
    await db.addEvent(event_to_add);
    const e1 = db.getEventByID(event_to_add.id);
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

    const res = await stream.pop() as {
        event: Parsed_Event;
        relay?: string | undefined;
    };
    const e = res.event;
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
    const event_to_add2 = await prepareNostrEvent(ctx, {
        kind: NostrKind.TEXT_NOTE,
        content: "2",
    }) as NostrEvent;
    // console.log(event_to_add2.id, event_to_add.id)
    await db.addEvent(event_to_add2);
    const res_2 = await stream.pop() as {
        event: Parsed_Event;
        relay?: string | undefined;
    };
    const e2 = res_2.event;
    assertEquals(
        res_2,
        await stream2.pop() as {
            event: Parsed_Event;
            relay?: string | undefined;
        },
    );
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
    const db = await test_db_view();

    const stream = db.subscribe();
    const event_to_add = await prepareNostrEvent(ctx, {
        kind: NostrKind.TEXT_NOTE,
        content: "1",
    }) as NostrEvent;
    const event_to_add_2 = await prepareNostrEvent(ctx, {
        kind: NostrKind.TEXT_NOTE,
        content: "2",
    }) as NostrEvent;
    await db.addEvent(event_to_add); // send by client

    {
        const set = new ValueSet<URL>(url_identity);
        assertEquals(db.getRelayRecord(event_to_add.id), set);
    }

    await db.addEvent(event_to_add_2, new URL("wss://relay.blowater.app")); // receiver from relay

    {
        const set = new ValueSet<URL>(url_identity);
        set.add(new URL("wss://relay.blowater.app"));
        assertEquals(db.getRelayRecord(event_to_add_2.id), set);
    }

    {
        await db.addEvent(event_to_add_2, new URL("wss://relay.test.app/nostr/space"));
        const set = new ValueSet<URL>(url_identity);
        set.add(new URL("wss://relay.blowater.app"));
        set.add(new URL("wss://relay.test.app/nostr/space"));
        assertEquals(
            db.getRelayRecord(event_to_add_2.id),
            set,
        );
    }

    await stream.pop();
    await stream.pop();
    await stream.pop();
});

Deno.test("mark removed event", async () => {
    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const db = await test_db_view();
    const event_to_add = await prepareNostrEvent(ctx, {
        kind: NostrKind.TEXT_NOTE,
        content: "1",
    }) as NostrEvent;

    const parsed_event = await db.addEvent(event_to_add);
    const retrieved_event = db.getEventByID(event_to_add.id);
    if (retrieved_event == undefined) fail();

    assertEquals(parsed_event, retrieved_event);
    assertEquals(retrieved_event.id, event_to_add.id);

    await db.remove(event_to_add.id);
    const retrieved_event_2 = db.getEventByID(event_to_add.id);
    assertEquals(retrieved_event_2, undefined);

    const added_event = await db.addEvent(event_to_add);
    assertEquals(added_event, false);

    const retrieved_event_3 = db.getEventByID(event_to_add.id);
    assertEquals(retrieved_event_3, undefined);
});

Deno.test("getAllEvents", async () => {
    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const db = await test_db_view();
    const event_to_add = await prepareNostrEvent(ctx, {
        kind: NostrKind.TEXT_NOTE,
        content: "1",
    }) as NostrEvent;

    assertEquals(Array.from(db.getAllEvents()), []);

    await db.addEvent(event_to_add);
    assertEquals(Array.from(db.getAllEvents()).length == 1, true);

    await db.remove(event_to_add.id);
    assertEquals(Array.from(db.getAllEvents()), []);
});
