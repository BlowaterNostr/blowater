/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Datebase_View } from "../database.ts";
import { testEventBus } from "./_setup.test.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { DM_List } from "./conversation-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { LamportTime } from "../time.ts";
import { initialModel } from "./app_model.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { OtherConfig } from "./config-other.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { GroupMessageController } from "../features/gm.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Datebase_View.New(indexedDB, indexedDB);
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

const allUserInfo = new DM_List(ctx, new ProfileSyncer(database, new ConnectionPool()));
allUserInfo.addEvents([e]);
allUserInfo.addEvents(database.events);
console.log(database.events);
const pool = new ConnectionPool();
const model = initialModel();

pool.addRelayURL(relays[0]);

const gmControl = new GroupMessageController(ctx, { add: (_) => {} }, { add: (_) => {} });

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
            currentEditor={model.dm.currentEditor}
            focusedContent={model.dm.focusedContent}
            ctx={ctx}
            pool={pool}
            isGroupMessage={false}
            pinListGetter={new OtherConfig()}
            profileGetter={database}
            dmGetter={new DirectedMessageController(ctx)}
            groupChatController={gmControl}
            gmGetter={gmControl}
            newMessageChecker={allUserInfo}
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
            model.dmEditors,
            model.gmEditors,
            database,
            gmControl,
        );

        if (err instanceof Error) {
            console.error("update:SendMessage", err);
            continue; // todo: global error toast
        }
    }
    render(view(), document.body);
}
