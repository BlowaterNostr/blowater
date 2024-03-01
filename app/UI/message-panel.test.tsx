/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { LamportTime } from "../time.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { MessagePanel } from "./message-panel.tsx";
import { DirectedMessageController } from "../features/dm.ts";
import { DM_List } from "./conversation-list.ts";
import { EditorModel } from "./editor.tsx";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const database = await test_db_view();

const lamport = new LamportTime();

// await database.addEvent(
//     await prepareNormalNostrEvent(ctx, {
//         content: "hi",
//         kind: NostrKind.TEXT_NOTE,
//     }),
// );
// await database.addEvent(
//     await prepareNormalNostrEvent(ctx, {
//         content: "hi 2",
//         kind: NostrKind.TEXT_NOTE,
//     }),
// );
// await database.addEvent(
//     await prepareNormalNostrEvent(ctx, {
//         content: "hi 3",
//         kind: NostrKind.TEXT_NOTE,
//     }),
// );
const pool = new ConnectionPool();
const model = initialModel();
pool.addRelayURL(relays[2]);

const editor: EditorModel = {
    pubkey: ctx.publicKey,
    text: "hi",
    files: [],
};

const view = () => {
    if (editor == undefined) {
        return undefined;
    }
    return (
        <div class="w-screen h-screen">
            <MessagePanel
                profileGetter={database}
                editorModel={editor}
                kind={NostrKind.DIRECT_MESSAGE}
                eventSyncer={new EventSyncer(pool, database)}
                focusedContent={undefined}
                myPublicKey={ctx.publicKey}
                emit={testEventBus.emit}
                relayRecordGetter={database}
                eventSub={testEventBus}
                userBlocker={new DM_List(ctx)}
                messages={new DirectedMessageController(ctx).getChatMessages(ctx.publicKey.hex)}
            />
        </div>
    );
};

render(view(), document.body);

for await (const event of testEventBus.onChange()) {
    console.log(event);
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
