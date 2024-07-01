/* @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PublicMessageContainer } from "./public-message-container.tsx";
import { relays } from "@blowater/nostr-sdkrelay-list.test.ts";
import { ConnectionPool } from "@blowater/nostr-sdkrelay-pool.ts";
import { testEventBus } from "./_setup.test.ts";
import { SingleRelayConnection } from "@blowater/nostr-sdkrelay-single.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "@blowater/nostr-sdk";
import { NewIndexedDB } from "./dexie-db.ts";
import { Database_View } from "../database.ts";
import { prepareEncryptedNostrEvent } from "@blowater/nostr-sdkevent.ts";
import { DM_List } from "./conversation-list.ts";
import { DirectedMessageController } from "../features/dm.ts";

const ctx = InMemoryAccountContext.Generate();

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Database_View.New(indexedDB, indexedDB, indexedDB);

const pool = new ConnectionPool();
pool.addRelayURL(relays[2]);

const relay = pool.getRelay(relays[2]) as SingleRelayConnection;

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
        relay_url={relay.url}
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
