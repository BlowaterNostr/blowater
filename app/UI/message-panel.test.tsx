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
import { handle_SendMessage } from "./app_update.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { MessagePanel } from "./message-panel.tsx";
import { DirectedMessageController } from "../features/dm.ts";
import { DM_List } from "./conversation-list.ts";
import { EditorModel } from "./editor.tsx";
import { NostrEvent } from "../../libs/nostr.ts/nostr.ts";

const lamport = new LamportTime();
const model = initialModel();
const pool = new ConnectionPool();
pool.addRelayURL(relays[2]);
const database = await test_db_view();
const receiverPublicKey = InMemoryAccountContext.Generate().publicKey;
const editor: EditorModel = {
    pubkey: receiverPublicKey,
    text: "hi",
    files: [],
};
const sender = InMemoryAccountContext.Generate();

const eventsToSend: NostrEvent[] = [];
for (let i = 1; i <= 3; i++) {
    const nostrEvent = await prepareEncryptedNostrEvent(
        sender,
        {
            encryptKey: receiverPublicKey,
            kind: NostrKind.DIRECT_MESSAGE,
            tags: [
                ["p", sender.publicKey.hex],
                ["lamport", lamport.now().toString()],
            ],
            content: `test:${i}`,
        },
    );
    if (nostrEvent instanceof Error) {
        fail(nostrEvent.message);
    }
    eventsToSend.push(nostrEvent);
}
database.addEvent(eventsToSend[0]);
database.addEvent(eventsToSend[1]);
database.addEvent(eventsToSend[2]);

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
                myPublicKey={sender.publicKey}
                emit={testEventBus.emit}
                relayRecordGetter={database}
                eventSub={testEventBus}
                userBlocker={new DM_List(sender)}
                messages={new DirectedMessageController(sender).getChatMessages(sender.publicKey.hex)}
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
            sender,
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
