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
        const messages = dmController.getChatMessages(ctx.publicKey.hex);
        assertEquals(messages, []);

        // get an observable channel before adding events
        const chan = dmController.getDirectMessageStream(ctx.publicKey.hex);
        {
            // add events
            const events = [];
            for (let i = 1; i <= 3; i++) {
                const event = await prepareEncryptedNostrEvent(ctx, {
                    content: `test:${i}`,
                    encryptKey: ctx.publicKey,
                    kind: NostrKind.DIRECT_MESSAGE,
                    tags: [
                        ["p", ctx.publicKey.hex],
                    ],
                });
                if (event instanceof Error) fail(event.message);

                events.push(event);
            }
            await dmController.addEvent(events[0]);
            await dmController.addEvent(events[1]);

            // get 2 events
            const new_messages = dmController.getChatMessages(ctx.publicKey.hex);
            assertEquals(new_messages.map((m) => m.content), ["test:1", "test:2"]);

            // the channel is able to retrieve all events
            const message = await chan.pop() as ChatMessage;
            assertEquals(message.content, "test:1");

            const message2 = await chan.pop() as ChatMessage;
            assertEquals(message2.content, "test:2");

            // get 3 events
            {
                await dmController.addEvent(events[2]);

                const new_messages = dmController.getChatMessages(ctx.publicKey.hex);
                assertEquals(new_messages.map((m) => m.content), ["test:1", "test:2", "test:3"]);

                assertEquals((await chan.pop() as ChatMessage).content, "test:3");
            }
        }
        await chan.close(); // not necessary
    }
});
