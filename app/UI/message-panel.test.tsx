/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "preact";
import { InMemoryAccountContext, NostrKind, prepareEncryptedNostrEvent } from "@blowater/nostr-sdk";

import { test_db_view, testEventBus } from "./_setup.test.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { DM_List } from "./conversation-list.ts";
import { MessagePanel } from "./message-panel.tsx";
import { sleep } from "@blowater/csp";

const database = await test_db_view();

const ctx = InMemoryAccountContext.Generate();
const dmController = new DirectedMessageController(ctx);

const event = await prepareEncryptedNostrEvent(ctx, {
    content: `test`,
    encryptKey: ctx.publicKey,
    kind: NostrKind.DIRECT_MESSAGE,
    tags: [
        ["p", ctx.publicKey.hex],
    ],
});
if (event instanceof Error) fail(event.message);

await dmController.addEvent(event);

const messages = dmController.getChatMessages(ctx.publicKey.hex);

for (let i = 10;; i++) {
    messages.push({
        author: ctx.publicKey,
        content: `${i}`,
        created_at: new Date(),
        event: messages[0].event,
        lamport: i,
        type: "text",
    });
    render(
        <div class="w-screen h-screen">
            <MessagePanel
                getters={{
                    relayRecordGetter: database,
                    isUserBlocked: new DM_List(ctx).isUserBlocked,
                    getEventByID: database.getEventByID,
                    getProfileByPublicKey: database.getProfileByPublicKey,
                    getProfilesByText: database.getProfilesByText,
                    getReactionsByEventID: database.getReactionEvents,
                    isAdmin: () => false,
                    messageGetter: dmController,
                }}
                myPublicKey={ctx.publicKey}
                emit={testEventBus.emit}
                eventSub={testEventBus}
                messages={messages}
            />
        </div>,
        document.body,
    );
    await sleep(100);
}
