/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "preact";
import { prepareEncryptedNostrEvent } from "@blowater/nostr-sdk";
import { InMemoryAccountContext, NostrKind } from "@blowater/nostr-sdk";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { MessageList } from "./message-list.tsx";
import { sleep } from "@blowater/csp";

const database = await test_db_view();

const ctx = InMemoryAccountContext.Generate();
const dmController = new DirectedMessageController(ctx);

const event = await prepareEncryptedNostrEvent(ctx, {
    content: `test\ntest`,
    encryptKey: ctx.publicKey,
    kind: NostrKind.DIRECT_MESSAGE,
    tags: [
        ["p", ctx.publicKey.hex],
    ],
});
if (event instanceof Error) fail(event.message);

let messages = dmController.getChatMessages(ctx.publicKey.hex);
for (let i = 1;; i++) {
    messages.push({
        author: ctx.publicKey,
        content: `${i}`,
        created_at: new Date(i * 1000 * (i % 3 == 0 ? 61 : 29)),
        // @ts-ignore
        event: event,
        lamport: i,
        type: "text",
    });

    render(
        <MessageList
            myPublicKey={ctx.publicKey}
            messages={messages}
            emit={testEventBus.emit}
            getters={{
                relayRecordGetter: database,
                getEventByID: database.getEventByID,
                getProfileByPublicKey: database.getProfileByPublicKey,
                getReactionsByEventID: database.getReactionEvents,
                isAdmin: () => false,
                messageGetter: dmController,
            }}
        />,
        document.body,
    );
    await sleep(333);
}
