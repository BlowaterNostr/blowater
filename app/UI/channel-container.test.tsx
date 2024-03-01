/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ChannelContainer } from "./channel-container.tsx";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { testEventBus } from "./_setup.test.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { Datebase_View } from "../database.ts";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { DM_List } from "./conversation-list.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { EventSyncer } from "./event_syncer.ts";

const ctx = InMemoryAccountContext.Generate();

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Datebase_View.New(indexedDB, indexedDB, indexedDB);

const pool = new ConnectionPool();
pool.addRelayURL(relays[2]);

const relay = pool.getRelay(relays[2]) as SingleRelayConnection;

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

const dmControl = new DirectedMessageController(ctx);

render(
    <ChannelContainer
        ctx={ctx}
        relay={relay}
        bus={testEventBus}
        getters={{
            convoListRetriever: dm_list,
            messageGetter: dmControl,
            newMessageChecker: dm_list,
            profileGetter: database,
            relayRecordGetter: database,
        }}
        currentChannel={undefined}
        relaySelectedChannel={new Map()}
        eventSyncer={new EventSyncer(pool, database)}
        userBlocker={dm_list}
    />,
    document.body,
);
