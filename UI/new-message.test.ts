import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { getTags, InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { NewMessageController } from "./new-message.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";

Deno.test("new message", async (t) => {
    const newMessageController = new NewMessageController();

    const my_ctx = InMemoryAccountContext.Generate();
    const other_ctx = InMemoryAccountContext.Generate();
    // receiver new message from other
    const event_send_to_me_1 = await prepareEncryptedNostrEvent(other_ctx, {
        encryptKey: my_ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        content: "hi",
        tags: [],
    });
    const event_send_to_me_2 = await prepareEncryptedNostrEvent(other_ctx, {
        encryptKey: my_ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        content: "nice to meet you",
        tags: [],
    });

    if (event_send_to_me_1 instanceof Error) {
        fail(event_send_to_me_1.message);
    }

    if (event_send_to_me_2 instanceof Error) {
        fail(event_send_to_me_2.message);
    }

    await t.step("receiver", async () => {
        newMessageController.addEvents([{
            ...event_send_to_me_1,
            parsedTags: getTags(event_send_to_me_1),
            publicKey: PublicKey.FromHex(event_send_to_me_1.pubkey) as PublicKey,
        }, {
            ...event_send_to_me_2,
            parsedTags: getTags(event_send_to_me_2),
            publicKey: PublicKey.FromHex(event_send_to_me_2.pubkey) as PublicKey,
        }]);

        assertEquals(
            newMessageController.getNewMessage(other_ctx.publicKey.hex, false),
            new Set([
                event_send_to_me_1.id,
                event_send_to_me_2.id,
            ]),
        );
    });

    await t.step("read one message", () => {
        newMessageController.setNewMessage("read", other_ctx.publicKey.hex, event_send_to_me_1.id);

        assertEquals(
            newMessageController.getNewMessage(other_ctx.publicKey.hex, false),
            new Set([
                event_send_to_me_2.id,
            ]),
        );
    });

    await t.step("mark one message as unread", () => {
        newMessageController.setNewMessage("unread", other_ctx.publicKey.hex, event_send_to_me_1.id);
        assertEquals(
            newMessageController.getNewMessage(other_ctx.publicKey.hex, false),
            new Set([
                event_send_to_me_1.id,
                event_send_to_me_2.id,
            ]),
        );
    });

    await t.step("mark one person's message as read", () => {
        newMessageController.setNewMessage("read", other_ctx.publicKey.hex);

        assertEquals(newMessageController.getNewMessage(other_ctx.publicKey.hex, false), new Set([]));
    });
});
