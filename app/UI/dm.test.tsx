/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { Datebase_View } from "../database.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { LamportTime } from "../time.ts";
import { testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { EventSyncer } from "./event_syncer.ts";

const ctx = InMemoryAccountContext.Generate();
const pool = new ConnectionPool();
pool.addRelayURL(relays[0]);

const model = initialModel();

const dmControl = new DirectedMessageController(ctx);

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Datebase_View.New(indexedDB, indexedDB, indexedDB);

const lamport = new LamportTime();

const dm_list = new DM_List(ctx);

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

// for (let i = 0; i < 20; i++) {
//     const event = await prepareEncryptedNostrEvent(ctx, {
//         content: "",
//         encryptKey: ctx.publicKey,
//         kind: NostrKind.DIRECT_MESSAGE,
//         tags: [
//             ["p", PrivateKey.Generate().toPublicKey().hex],
//         ],
//     }) as NostrEvent;
//     const err = dm_list.addEvents([event], true);
//     if (err instanceof Error) {
//         fail(err.message);
//     }
// }

render(
    <DirectMessageContainer
        eventSyncer={new EventSyncer(pool, database)}
        bus={testEventBus}
        currentEditor={model.dm.currentEditor}
        focusedContent={model.dm.focusedContent}
        ctx={ctx}
        getters={{
            convoListRetriever: dm_list,
            messageGetter: dmControl,
            newMessageChecker: dm_list,
            pinListGetter: OtherConfig.Empty(new Channel(), ctx, lamport),
            profileGetter: database,
            relayRecordGetter: database,
            isUserBlocked: dm_list.isUserBlocked,
        }}
        userBlocker={dm_list}
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
