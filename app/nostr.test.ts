import {
    InMemoryAccountContext,
    NostrEvent,
    NostrKind,
    prepareNostrEvent,
    PrivateKey,
    utf8Decode,
} from "@blowater/nostr-sdk";
import { blobToBase64, prepareNostrImageEvent, prepareReplyEvent } from "./nostr.ts";
import { assertEquals, fail } from "@std/assert";

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
        const decryptedEvent_content = await ctx.decrypt(imgEvent.pubkey, imgEvent.content);
        if (decryptedEvent_content instanceof Error) {
            fail(decryptedEvent_content.message);
        }

        assertEquals(await blobToBase64(blob), decryptedEvent_content);
    });
});

Deno.test("Generate reply event", async () => {
    const userAPrivateKey = PrivateKey.Generate();
    const userAContext = InMemoryAccountContext.New(userAPrivateKey);

    const message1 = await prepareNostrEvent(
        userAContext,
        {
            kind: NostrKind.DIRECT_MESSAGE,

            content: "text message 1",
        },
    ) as NostrEvent;

    const replyMessage1WithText = await prepareReplyEvent(
        userAContext,
        {
            targetEvent: message1,
            tags: [],
            content: "aaaa",
            currentRelay: new URL("wss://relay-url"),
        },
    ) as NostrEvent;

    assertEquals(replyMessage1WithText.kind, message1.kind);
    assertEquals(replyMessage1WithText.pubkey, userAPrivateKey.toPublicKey().hex);
    assertEquals(replyMessage1WithText.tags, [[
        "e",
        message1.id,
        "wss://relay-url/",
        "reply",
    ]]);
});
