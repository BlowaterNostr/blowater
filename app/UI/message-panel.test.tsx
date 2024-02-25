/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { LamportTime } from "../time.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { MessagePanel } from "./message-panel.tsx";
import { DirectedMessageController } from "../features/dm.ts";
import { DM_List } from "./conversation-list.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const database = await test_db_view();

const lamport = new LamportTime();

await database.addEvent(
    await prepareNormalNostrEvent(ctx, {
        content: "hi",
        kind: NostrKind.TEXT_NOTE,
    }),
);
await database.addEvent(
    await prepareNormalNostrEvent(ctx, {
        content: "hi 2",
        kind: NostrKind.TEXT_NOTE,
    }),
);
await database.addEvent(
    await prepareNormalNostrEvent(ctx, {
        content: "hi 3",
        kind: NostrKind.TEXT_NOTE,
    }),
);
const pool = new ConnectionPool();
const model = initialModel();
pool.addRelayURL(relays[0]);

const editor = model.dmEditors.get(ctx.publicKey.hex);

const view = () => {
    if (editor == undefined) {
        return undefined;
    }
    return (
        <MessagePanel
            profileGetter={database}
            /**
             * If we use a map to store all editor models,
             * need to distinguish editor models for DMs and GMs
             */
            editorModel={editor}
            eventSyncer={new EventSyncer(pool, database)}
            focusedContent={undefined}
            myPublicKey={ctx.publicKey}
            profilesSyncer={new ProfileSyncer(database, pool)}
            emit={testEventBus.emit}
            newMessageListener={new DirectedMessageController(ctx)}
            relayRecordGetter={database}
            eventSub={testEventBus}
            userBlocker={new DM_List(ctx)}
            messageGetter={new DirectedMessageController(ctx)}
        />
    );
};

render(view(), document.body);

for await (const e of testEventBus.onChange()) {
    console.log(e);
    if (e.type == "SendMessage") {
        const err = await handle_SendMessage(
            e,
            ctx,
            lamport,
            pool,
            model.dmEditors,
            model.gmEditors,
            database,
        );
        if (err instanceof Error) {
            console.error("update:SendMessage", err);
            continue; // todo: global error toast
        }
    } else if (e.type == "UpdateEditorText") {
    }
    render(view(), document.body);
}
