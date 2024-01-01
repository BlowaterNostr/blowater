/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent } from "../../0_lib/nostr-ts/event.ts";
import { PrivateKey } from "../../0_lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind, NostrEvent } from "../../0_lib/nostr-ts/nostr.ts";
import { relays } from "../../0_lib/nostr-ts/relay-list.test.ts";
import { ConnectionPool } from "../../0_lib/nostr-ts/relay-pool.ts";
import { Datebase_View } from "../database.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { GroupMessageController } from "../features/gm.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { LamportTime } from "../time.ts";
import { testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { EventSyncer } from "./event_syncer.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Datebase_View.New(indexedDB, indexedDB, indexedDB);

const lamport = new LamportTime();

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

const dm_list = new DM_List(ctx);
dm_list.addEvents([e], true);
dm_list.addEvents(Array.from(database.getAllEvents()), true);

for (let i = 0; i < 20; i++) {
    const event = await prepareEncryptedNostrEvent(ctx, {
        content: "",
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [
            ["p", PrivateKey.Generate().toPublicKey().hex],
        ],
    }) as NostrEvent;
    const err = dm_list.addEvents([event], true);
    if (err instanceof Error) {
        fail(err.message);
    }
}

const pool = new ConnectionPool();
const model = initialModel();

pool.addRelayURL(relays[0]);

const gmControl = new GroupMessageController(ctx, { add: (_) => {} }, { add: (_) => {} });
const dmControl = new DirectedMessageController(ctx);

render(
    <DirectMessageContainer
        conversationLists={dm_list}
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
        pinListGetter={OtherConfig.Empty(new Channel(), ctx, lamport)}
        profileGetter={database}
        groupChatController={gmControl}
        messageGetter={gmControl}
        newMessageChecker={dm_list}
        newMessageListener={dmControl}
        relayRecordGetter={database}
    />,
    document.body,
);

(async () => {
    for await (const event of database.subscribe()) {
        if (event == null) {
            continue;
        }
        dm_list.addEvents([event], true);
    }
})();
