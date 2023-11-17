/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ConversationList } from "./conversation-list.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Datebase_View } from "../database.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { DM_List } from "./conversation-list.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { OtherConfig } from "./config-other.ts";
import { GroupChatSyncer, GroupMessageController } from "../features/gm.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const db = NewIndexedDB();
if (db instanceof Error) {
    fail(db.message);
}
const database = await Datebase_View.New(db, db);

const pool = new ConnectionPool();
const profileSyncer = new ProfileSyncer(database, pool);
const convoLists = new DM_List(ctx, profileSyncer);
const gmc = new GroupMessageController(ctx, new GroupChatSyncer(database, pool), profileSyncer);
convoLists.addEvents(Array.from(database.events.values()));

const model = initialModel();

const view = () =>
    render(
        <ConversationList
            convoListRetriever={convoLists}
            hasNewMessages={new Set()}
            pinListGetter={OtherConfig.Empty()}
            eventBus={testEventBus}
            emit={testEventBus.emit}
            profileGetter={database}
            groupChatListGetter={gmc}
        />,
        document.body,
    );

view();
