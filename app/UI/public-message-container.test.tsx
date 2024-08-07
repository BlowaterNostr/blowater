/* @jsx h */
import { h, render } from "preact";
import { PublicMessageContainer } from "./public-message-container.tsx";
import { Database_View } from "../database.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { testEventBus } from "./_setup.test.ts";
import { DM_List } from "./conversation-list.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import {
    InMemoryAccountContext,
    NostrEvent,
    NostrKind,
    prepareEncryptedNostrEvent,
} from "@blowater/nostr-sdk";
import { fail } from "@std/assert";

const ctx = InMemoryAccountContext.Generate();

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Database_View.New(indexedDB, indexedDB, indexedDB);

const e = await database.addEvent(
    await prepareEncryptedNostrEvent(ctx, {
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [["p", InMemoryAccountContext.Generate().publicKey.hex]],
        content: "hi",
    }) as NostrEvent,
);
if (!e || e instanceof Error) {
    fail();
}

const dm_list = new DM_List(ctx);
dm_list.addEvents([e], true);
dm_list.addEvents(Array.from(database.getAllEvents()), true);

render(
    <PublicMessageContainer
        relay_url={"ws://localhost:8000"}
        ctx={ctx}
        bus={testEventBus}
        getters={{
            convoListRetriever: dm_list,
            newMessageChecker: dm_list,
            relayRecordGetter: database,
            isUserBlocked: dm_list.isUserBlocked,
            getEventByID: database.getEventByID,
            getProfileByPublicKey: database.getProfileByPublicKey,
            getProfilesByText: database.getProfilesByText,
            getReactionsByEventID: database.getReactionEvents,
            isAdmin: () => true,
            messageGetter: new DirectedMessageController(ctx),
        }}
        messages={[]}
        relaySelectedChannel={new Map()}
    />,
    document.body,
);
