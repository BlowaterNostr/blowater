import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { DirectedMessageController } from "./dm.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { ChatMessage } from "../UI/message.ts";

Deno.test("DirectedMessageController", async () => {
    const ctx = InMemoryAccountContext.Generate();
    const dmController = new DirectedMessageController(ctx);
    {
        // empty at first
        const messages = dmController.getDirectMessages(ctx.publicKey.hex);
        assertEquals(messages, []);

        // get an observable channel before adding events
        const chan = dmController.getDirectMessagesAsync(ctx.publicKey.hex);
        {
            // add events
            for (let i = 1; i <= 2; i++) {
                const event = await prepareEncryptedNostrEvent(ctx, {
                    content: `test:${i}`,
                    encryptKey: ctx.publicKey,
                    kind: NostrKind.DIRECT_MESSAGE,
                    tags: [
                        ["p", ctx.publicKey.hex],
                    ],
                });
                if (event instanceof Error) fail(event.message);

                const err = await dmController.addEvent(event);
                if (err instanceof Error) fail(err.message);
            }

            // get 2 events
            const new_messages = dmController.getDirectMessages(ctx.publicKey.hex);
            assertEquals(new_messages.map((m) => m.content), ["test:1", "test:2"]);

            // the channel is able to retrieve all events
            const message = await chan.pop() as ChatMessage;
            assertEquals(message.content, "test:1");

            const message2 = await chan.pop() as ChatMessage;
            assertEquals(message2.content, "test:2");
        }
        await chan.close(); // not necessary
    }
});
