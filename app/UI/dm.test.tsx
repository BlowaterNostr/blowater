/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "preact";
import { prepareEncryptedNostrEvent } from "@blowater/nostr-sdk";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "@blowater/nostr-sdk";
import { ConnectionPool } from "@blowater/nostr-sdk";
import { Database_View } from "../database.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { LamportTime } from "../time.ts";
import { testEventBus } from "./_setup.test.ts";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { DirectMessageContainer } from "./dm.tsx";

const ctx = InMemoryAccountContext.Generate();
const dmControl = new DirectedMessageController(ctx);

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Database_View.New(indexedDB, indexedDB, indexedDB);

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

render(
    <DirectMessageContainer
        bus={testEventBus}
        ctx={ctx}
        getters={{
            convoListRetriever: dm_list,
            messageGetter: dmControl,
            newMessageChecker: dm_list,
            pinListGetter: OtherConfig.Empty(ctx, lamport),
            relayRecordGetter: database,
            isUserBlocked: dm_list.isUserBlocked,
            getEventByID: database.getEventByID,
            getProfileByPublicKey: (pubkey) => database.getProfileByPublicKey("", pubkey),
            getProfilesByText: (name) => database.getProfilesByText("", name),
            getReactionsByEventID: database.getReactionEvents,
            isAdmin: () => false,
        }}
        userBlocker={dm_list}
        currentConversation={ctx.publicKey}
    />,
    document.body,
);

(async () => {
    for await (const event of database.subscribe()) {
        if (event == null) {
            continue;
        }
        dm_list.addEvents([event.event], true);
    }
})();
