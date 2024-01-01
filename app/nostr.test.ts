import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import {
    blobToBase64,
    decryptNostrEvent,
    InMemoryAccountContext,
    NostrEvent,
    NostrKind,
} from "../libs/nostr.ts/nostr.ts";
import { prepareNostrImageEvent, prepareReplyEvent } from "./nostr.ts";
import { PrivateKey } from "../libs/nostr.ts/key.ts";
import { utf8Decode } from "../libs/nostr.ts/ende.ts";
import { prepareNormalNostrEvent } from "../libs/nostr.ts/event.ts";

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
    const imgEvent = await prepareNostrImageEvent(
        ctx,
        pub,
        blob,
        NostrKind.DIRECT_MESSAGE,
    );
    if (imgEvent instanceof Error) {
        fail(imgEvent.message);
    }

    await t.step("full", async () => {
        const decryptedEvents = [];
        const decryptedEvent = await decryptNostrEvent(imgEvent, ctx, pub.hex);
        if (decryptedEvent instanceof Error) {
            fail(decryptedEvent.message);
        }
        decryptedEvents.push(decryptedEvent);
        assertEquals(await blobToBase64(blob), decryptedEvent.content);
    });
});

Deno.test("Generate reply event", async () => {
    const userAPrivateKey = PrivateKey.Generate();
    const userAContext = InMemoryAccountContext.New(userAPrivateKey);

    const message1 = await prepareNormalNostrEvent(
        userAContext,
        {
            kind: NostrKind.DIRECT_MESSAGE,

            content: "text message 1",
        },
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
