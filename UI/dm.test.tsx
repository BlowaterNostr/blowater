/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { testEventBus } from "./_setup.test.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { ConversationLists } from "./conversation-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { LamportTime } from "../time.ts";
import { initialModel } from "./app_model.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { GroupChatController } from "../group-chat.ts";
import { OtherConfig } from "./config-other.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Database_Contextual_View.New(indexedDB, ctx);
if (database instanceof Error) {
    fail(database.message);
}
const lamport = new LamportTime(0);

const e = await database.addEvent(
    await prepareEncryptedNostrEvent(ctx, {
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [["p", ctx.publicKey.hex]],
        content: "hi",
    }) as NostrEvent,
);
if (!e || e instanceof Error) {
    fail();
}

const allUserInfo = new ConversationLists(ctx, new ProfileSyncer(database, new ConnectionPool()));
allUserInfo.addEvents([e]);
allUserInfo.addEvents(database.events);
console.log(database.events);
const pool = new ConnectionPool();
const model = initialModel();
model.dm.currentEditor = ctx.publicKey;
model.editors.set(ctx.publicKey.hex, {
    files: [],
    id: ctx.publicKey.hex,
    tags: [["p", ctx.publicKey.hex]],
    target: {
        kind: NostrKind.DIRECT_MESSAGE,
        receiver: {
            pubkey: ctx.publicKey,
        },
    },
    text: "",
});

pool.addRelayURL(relays[0]);

const view = () => {
    return (
        <DirectMessageContainer
            conversationLists={allUserInfo}
            eventSyncer={new EventSyncer(pool, database)}
            profilesSyncer={new ProfileSyncer(database, pool)}
            bus={testEventBus}
            rightPanelModel={{
                show: true,
            }}
            editors={model.editors}
            currentEditor={model.dm.currentEditor}
            focusedContent={model.dm.focusedContent}
            hasNewMessages={model.dm.hasNewMessages}
            ctx={ctx}
            pool={pool}
            dmGetter={database}
            groupChatController={new GroupChatController(ctx, allUserInfo)}
            isGroupMessage={false}
            pinListGetter={new OtherConfig()}
            profileGetter={database}
        />
    );
};

render(view(), document.body);

(async () => {
    for await (const event of database.subscribe()) {
        if (event == null) {
            continue;
        }
        allUserInfo.addEvents([event]);
    }
})();

for await (const e of testEventBus.onChange()) {
    console.log(e);
    if (e.type == "SendMessage") {
        const err = await handle_SendMessage(
            e,
            ctx,
            lamport,
            pool,
            model.editors,
            database,
        );
        if (err instanceof Error) {
            console.error("update:SendMessage", err);
            continue; // todo: global error toast
        }
    } else if (e.type == "UpdateEditorText") {
        const event = e;
        if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
            const editor = model.editors.get(event.id);
            if (editor) {
                editor.text = event.text;
            } else {
                console.log(event.target.receiver, event.id);
                throw new Error("impossible state");
            }
        }
    }
    render(view(), document.body);
}
