import { assertEquals, assertNotEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import {
    blobToBase64,
    decryptNostrEvent,
    InMemoryAccountContext,
    NostrEvent,
    NostrKind,
} from "./lib/nostr-ts/nostr.ts";
import {
    computeThreads,
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
        // for (const e of events) {
        const decryptedEvent = await decryptNostrEvent(event, ctx, pub.hex);
        if (decryptedEvent instanceof Error) {
            fail(decryptedEvent.message);
        }
        decryptedEvents.push(decryptedEvent);
        // }
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

Deno.test("Group reply messages", async (t) => {
    const userAPrivateKey = PrivateKey.Generate();
    const userBPrivateKey = PrivateKey.Generate();
    const userAContext = InMemoryAccountContext.New(userAPrivateKey);
    const userBContext = InMemoryAccountContext.New(userBPrivateKey);
    const lamport = new LamportTime(0);

    await t.step("has reply", async () => {
        const message1 = await prepareNormalNostrEvent(
            userAContext,
            NostrKind.DIRECT_MESSAGE,
            [
                ["lamport", String(lamport.now())],
            ],
            "text message 1",
        );
        const message2 = await prepareReplyEvent(
            userAContext,
            message1,
            [["lamport", String(lamport.now())]],
            "text message 2, text message 1's reply",
        );
        const message3 = await prepareReplyEvent(
            userBContext,
            message1,
            [["lamport", String(lamport.now())]],
            "text message 3, text message 1's reply",
        ) as NostrEvent;
        const message4 = await prepareReplyEvent(
            userAContext,
            message3,
            [["lamport", String(lamport.now())]],
            "text message 4, text message 3's reply",
        );
        const message5 = await prepareReplyEvent(
            userBContext,
            message3,
            [["lamport", String(lamport.now())]],
            "text message 5, text message 3's reply",
        ) as NostrEvent;

        const message6LeadEventID = PrivateKey.Generate().hex;
        const message6 = await prepareNormalNostrEvent(
            userBContext,
            NostrKind.DIRECT_MESSAGE,
            [
                [
                    "image",
                    message6LeadEventID,
                    "3",
                    "0",
                ],
                ["lamport", String(lamport.now())],
            ],
            "image message 6",
        );
        const message7 = await prepareNormalNostrEvent(
            userBContext,
            NostrKind.DIRECT_MESSAGE,
            [
                [
                    "image",
                    message6LeadEventID,
                    "3",
                    "1",
                ],
                ["lamport", String(lamport.now())],
            ],
            "image message 7",
        );
        const message8 = await prepareNormalNostrEvent(
            userBContext,
            NostrKind.DIRECT_MESSAGE,
            [
                [
                    "image",
                    message6LeadEventID,
                    "3",
                    "2",
                ],
                ["lamport", String(lamport.now())],
            ],
            "image message 8",
        );
        const message9LeadEventID = PrivateKey.Generate().hex;
        const message9 = await prepareReplyEvent(
            userAContext,
            message6,
            [
                [
                    "image",
                    message9LeadEventID,
                    "3",
                    "0",
                ],
                ["lamport", String(lamport.now())],
            ],
            "image message 9, image message 6's reply",
        );
        const message10 = await prepareReplyEvent(
            userAContext,
            message6,
            [
                [
                    "image",
                    message9LeadEventID,
                    "3",
                    "1",
                ],
                ["lamport", String(lamport.now())],
            ],
            "image message 10, image message 6's reply",
        );
        const message11 = await prepareReplyEvent(
            userAContext,
            message6,
            [
                [
                    "image",
                    message9LeadEventID,
                    "3",
                    "2",
                ],
                ["lamport", String(lamport.now())],
            ],
            "image message 11, image message 6's reply",
        );
        const message12 = await prepareReplyEvent(
            userAContext,
            message5,
            [
                ["lamport", String(lamport.now())],
            ],
            "text message 12, text message 5's reply",
        );

        const testEvent = [
            message1,
            message2 as NostrEvent,
            message3 as NostrEvent,
            message4 as NostrEvent,
            message5 as NostrEvent,
            message6,
            message7,
            message8,
            message9 as NostrEvent,
            message10 as NostrEvent,
            message11 as NostrEvent,
            message12 as NostrEvent,
        ].map((e): parsedTagsEvent => {
            return {
                ...e,
                parsedTags: getTags(e),
            };
        });

        const validResult = new Set<Set<NostrEvent>>([
            new Set([
                message1 as NostrEvent,
                message2 as NostrEvent,
                message3 as NostrEvent,
                message4 as NostrEvent,
                message5 as NostrEvent,
                message12 as NostrEvent,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
            new Set([
                message6 as NostrEvent,
                message7 as NostrEvent,
                message8 as NostrEvent,
                message9 as NostrEvent,
                message10 as NostrEvent,
                message11 as NostrEvent,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
        ]);

        for (let i = 0; i < 10; i++) {
            const result = computeThreads(testEvent.sort((a, b) => 0.5 - Math.random()));
            const res = new Set(result.map((r) => new Set(r)));
            assertEquals(res, validResult);
        }
    });

    await t.step("no reply", async () => {
        const message1 = await prepareNormalNostrEvent(
            userAContext,
            NostrKind.DIRECT_MESSAGE,
            [],
            "text message 1",
        );

        const message2LeadEventID = PrivateKey.Generate().hex;
        const message2 = await prepareNormalNostrEvent(
            userBContext,
            NostrKind.DIRECT_MESSAGE,
            [
                [
                    "image",
                    message2LeadEventID,
                    "3",
                    "0",
                ],
            ],
            "text message 2",
        );
        const message3 = await prepareNormalNostrEvent(
            userBContext,
            NostrKind.DIRECT_MESSAGE,
            [
                [
                    "image",
                    message2LeadEventID,
                    "3",
                    "1",
                ],
            ],
            "text message 3",
        );
        const message4 = await prepareNormalNostrEvent(
            userBContext,
            NostrKind.DIRECT_MESSAGE,
            [
                [
                    "image",
                    message2LeadEventID,
                    "3",
                    "2",
                ],
            ],
            "text message 4",
        );

        const testEvent = [
            message1,
            message2,
            message3,
            message4,
        ].map((e): parsedTagsEvent => {
            return {
                ...e,
                parsedTags: getTags(e),
            };
        });

        const validResult = new Set([
            new Set([
                message1,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
            new Set([
                message2,
                message3,
                message4,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
        ]);

        for (let i = 0; i < 10; i++) {
            const result = computeThreads(testEvent.sort((a, b) => 0.5 - Math.random()));
            const res = new Set(result.map((r) => new Set(r)));
            assertEquals(res, validResult);
        }
    });

    await t.step("has reply but no root", async () => {
        const message1 = await prepareNormalNostrEvent(
            userAContext,
            NostrKind.DIRECT_MESSAGE,
            [],
            "text message 1",
        );

        const notUsed = await prepareNormalNostrEvent(
            userAContext,
            NostrKind.DIRECT_MESSAGE,
            [],
            "not used",
        );

        const message2 = await prepareReplyEvent(
            userAContext,
            notUsed,
            [],
            "text",
        ) as NostrEvent;

        const message3 = await prepareReplyEvent(
            userAContext,
            notUsed,
            [[
                "image",
                PrivateKey.Generate().hex,
                "1",
                "0",
            ]],
            "image",
        ) as NostrEvent;

        const testEvent = [
            message1,
            message2,
            message3,
        ].map((e): parsedTagsEvent => {
            return {
                ...e,
                parsedTags: getTags(e),
            };
        });

        const validResult = new Set([
            new Set([
                message1,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
            new Set([
                message2,
                message3,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
        ]);

        for (let i = 0; i < 10; i++) {
            const result = computeThreads(testEvent.sort((a, b) => 0.5 - Math.random()));
            const res = new Set(result.map((r) => new Set(r)));
            assertEquals(res, validResult);
        }
    });

    await t.step("if one of reply has both reply tag and root tag", async () => {
        const userAPrivateKey = PrivateKey.Generate();
        const userBPrivateKey = PrivateKey.Generate();
        const userAContext = InMemoryAccountContext.New(userAPrivateKey);
        const userBContext = InMemoryAccountContext.New(userBPrivateKey);
        const message1 = await prepareNormalNostrEvent(
            userAContext,
            NostrKind.TEXT_NOTE,
            [],
            "message 1",
        );
        const message2 = await prepareReplyEvent(
            userAContext,
            message1,
            [],
            "message2, message1's reply",
        ) as NostrEvent;
        const message3 = await prepareReplyEvent(
            userBContext,
            message1,
            [],
            "message3, message1's reply",
        ) as NostrEvent;
        const message4 = await prepareReplyEvent(
            userAContext,
            message2,
            [
                [
                    "e",
                    message1.id,
                    "",
                    "root",
                ],
            ],
            "message4, message 2' reply",
        ) as NostrEvent;

        const testEvent = [
            message1,
            message2,
            message3,
            message4,
        ].map((e): parsedTagsEvent => {
            return {
                ...e,
                parsedTags: getTags(e),
            };
        });

        const validResult = new Set([
            new Set([
                message1,
                message2,
                message3,
                message4,
            ].map((e): parsedTagsEvent => {
                return {
                    ...e,
                    parsedTags: getTags(e),
                };
            })),
        ]);

        for (let i = 0; i < 10; i++) {
            const data = testEvent.sort((a, b) => 0.5 - Math.random());
            console.log(data);
            const result = computeThreads(data);
            const res = new Set(result.map((r) => new Set(r)));
            assertEquals(res, validResult);
        }
    });
});
