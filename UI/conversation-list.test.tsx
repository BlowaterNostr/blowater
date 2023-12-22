/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ConversationList } from "./conversation-list.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Datebase_View } from "../database.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { testEventBus } from "./_setup.test.ts";
import { DM_List } from "./conversation-list.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { OtherConfig } from "./config-other.ts";
import { GroupChatSyncer, GroupMessageController } from "../features/gm.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { LamportTime } from "../time.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";

const ctx = InMemoryAccountContext.Generate();
const db = NewIndexedDB();
if (db instanceof Error) {
    fail(db.message);
}
const database = await Datebase_View.New(db, db, db);

const pool = new ConnectionPool();
const profileSyncer = new ProfileSyncer(database, pool);

const gmc = new GroupMessageController(ctx, new GroupChatSyncer(database, pool), profileSyncer);
const dm_list = new DM_List(ctx);

for (let i = 0; i < 20; i++) {
    const event = await prepareEncryptedNostrEvent(ctx, {
        content: "",
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [
            ["p", PrivateKey.Generate().toPublicKey().hex],
        ],
    }) as NostrEvent;
    const err = dm_list.addEvents([event]);
    if (err instanceof Error) {
        fail(err.message);
    }
}

const otherConfig = OtherConfig.Empty(new Channel(), ctx, new LamportTime());

const view = () =>
    render(
        <ConversationList
            hasNewMessages={new Set()}
            eventBus={testEventBus}
            emit={testEventBus.emit}
            profileGetter={database}
            groupChatListGetter={gmc}
            convoListRetriever={dm_list}
            pinListGetter={otherConfig}
        />,
        document.body,
    );

view();
