import { assertEquals, assertNotEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import {
    blobToBase64,
    decryptNostrEvent,
    InMemoryAccountContext,
    NostrEvent,
    NostrKind,
} from "./lib/nostr-ts/nostr.ts";
import {
    getTags,
    groupImageEvents,
    Parsed_Event,
    parsedTagsEvent,
    prepareNostrImageEvent,
    prepareReplyEvent,
    reassembleBase64ImageFromEvents,
} from "./nostr.ts";
import { LamportTime } from "./time.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { utf8Decode } from "./lib/nostr-ts/ende.ts";
import { prepareNormalNostrEvent } from "./lib/nostr-ts/event.ts";

Deno.test("prepareNostrImageEvent", async (t) => {
    const pri = PrivateKey.Generate();
    const pub = pri.toPublicKey();
    const ctx = InMemoryAccountContext.New(pri);

    let randomData = new Uint8Array(1024 * 32); // 48KB raw data
    for (let i = 0; i < randomData.length; i++) {
        randomData.fill(Math.floor(Math.random() * 128), i); // https://en.wikipedia.org/wiki/UTF-8
    }
    let randomStr = utf8Decode(randomData);

    const blob = new Blob([randomStr]);
    const imgEvents = await prepareNostrImageEvent(
        ctx,
        pub,
        blob,
        NostrKind.DIRECT_MESSAGE,
    );
    if (imgEvents instanceof Error) {
        fail(imgEvents.message);
    }
    const [event, _] = imgEvents;
    await t.step("full", async () => {
        const decryptedEvents = [];
        const decryptedEvent = await decryptNostrEvent(event, ctx, pub.hex);
        if (decryptedEvent instanceof Error) {
            fail(decryptedEvent.message);
        }
        decryptedEvents.push(decryptedEvent);

        const content = reassembleBase64ImageFromEvents(decryptedEvents);
        if (content instanceof Error) {
            fail(content.message);
        }
        assertEquals(await blobToBase64(blob), content);
    });
});

Deno.test("groupImageEvents", async () => {
    const pri = PrivateKey.Generate();
    const pub = pri.toPublicKey();
    const ctx = InMemoryAccountContext.New(pri);

    let randomData = new Uint8Array(1024 * 17);
    for (let i = 0; i < randomData.length; i++) {
        randomData.fill(Math.floor(Math.random() * 128), i); // https://en.wikipedia.org/wiki/UTF-8
    }
    let randomStr = utf8Decode(randomData);

    const blob = new Blob([randomStr]);
    const imgEvent1 = await prepareNostrImageEvent(
        ctx,
        pub,
        blob,
        NostrKind.DIRECT_MESSAGE,
    );
    if (imgEvent1 instanceof Error) {
        fail(imgEvent1.message);
    }
    const [event1, id1] = imgEvent1;
    const imgEvent2 = await prepareNostrImageEvent(
        ctx,
        pub,
        blob,
        NostrKind.DIRECT_MESSAGE,
    );
    if (imgEvent2 instanceof Error) {
        fail(imgEvent2.message);
    }
    const [event2, id2] = imgEvent2;
    const groups = groupImageEvents(
        [event1, event2].map((e): Parsed_Event => ({
            ...e,
            kind: e.kind as NostrKind.DIRECT_MESSAGE,
            publicKey: PublicKey.FromHex(e.pubkey) as PublicKey,
            parsedTags: getTags(e),
        })),
    );
    assertEquals(groups.size, 2);

    const group1 = groups.get(id1)?.map((e): NostrEvent => ({
        content: e.content,
        created_at: e.created_at,
        id: e.id,
        kind: e.kind,
        pubkey: e.pubkey,
        sig: e.sig,
        tags: e.tags,
    }));
    assertNotEquals(group1, undefined);
    assertEquals(group1, [event1]);

    const group2 = groups.get(id2)?.map((e): NostrEvent => ({
        content: e.content,
        created_at: e.created_at,
        id: e.id,
        kind: e.kind,
        pubkey: e.pubkey,
        sig: e.sig,
        tags: e.tags,
    }));
    assertNotEquals(group2, undefined);
    assertEquals(group2, [event2]);
});

Deno.test("Generate reply event", async () => {
    const userAPrivateKey = PrivateKey.Generate();
    const userAContext = InMemoryAccountContext.New(userAPrivateKey);

    const message1 = await prepareNormalNostrEvent(
        userAContext,
        NostrKind.DIRECT_MESSAGE,
        [],
        "text message 1",
    );

    const replyMessage1WithText = await prepareReplyEvent(
        userAContext,
        message1,
        [],
        "aaaa",
    ) as NostrEvent;

    assertEquals(replyMessage1WithText.kind, message1.kind);
    assertEquals(replyMessage1WithText.pubkey, userAPrivateKey.toPublicKey().hex);
    assertEquals(replyMessage1WithText.tags, [[
        "e",
        message1.id,
        "",
        "reply",
    ]]);
});
