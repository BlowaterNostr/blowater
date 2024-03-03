/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { LamportTime } from "../time.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { EventSyncer } from "./event_syncer.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { DM_List } from "./conversation-list.ts";

import { handle_SendMessage } from "./app_update.tsx";
import { MessagePanel } from "./message-panel.tsx";
import { EditorModel } from "./editor.tsx";

const lamport = new LamportTime();
const pool = new ConnectionPool();
pool.addRelayURL(relays[2]);
const database = await test_db_view();
const eventSyncer = new EventSyncer(pool, database);

const ctx = InMemoryAccountContext.Generate();
const dmController = new DirectedMessageController(ctx);
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
await dmController.addEvent(events[2]);
const editor: EditorModel = {
    pubkey: ctx.publicKey,
    text: "hi",
    files: [],
};
const messages = dmController.getChatMessages(ctx.publicKey.hex);
const model = initialModel();

const view = () => {
    if (editor == undefined) {
        return undefined;
    }
    return (
        <div class="w-screen h-screen">
            <MessagePanel
                getters={{
                    profileGetter: database,
                    relayRecordGetter: database,
                    isUserBlocked: new DM_List(ctx).isUserBlocked,
                }}
                editorModel={editor}
                eventSyncer={eventSyncer}
                focusedContent={undefined}
                myPublicKey={ctx.publicKey}
                emit={testEventBus.emit}
                eventSub={testEventBus}
                messages={messages}
            />
        </div>
    );
};

render(view(), document.body);

for await (const event of testEventBus.onChange()) {
    if (event.type == "SendMessage") {
        const currentRelay = pool.getRelay(model.currentRelay);
        if (!currentRelay) {
            console.error(`currentRelay is not found: ${model.currentRelay}`);
            continue;
        }
        handle_SendMessage(
            event,
            ctx,
            lamport,
            currentRelay,
            model.dmEditors,
            database,
        ).then((res) => {
            if (res instanceof Error) {
                console.error("update:SendMessage", res);
            }
        });
    } else if (event.type == "UpdateEditorText") {
    }
    render(view(), document.body);
}
