/** @jsx h */
import { h, render } from "preact";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "@blowater/nostr-sdk";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Channel } from "@blowater/csp";
import { prepareEncryptedNostrEvent } from "@blowater/nostr-sdk";
import { PrivateKey } from "@blowater/nostr-sdk";
import { Database_View } from "../database.ts";
import { LamportTime } from "../time.ts";
import { testEventBus } from "./_setup.test.ts";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { ConversationList } from "./conversation-list.tsx";
import { NewIndexedDB } from "./dexie-db.ts";

const ctx = InMemoryAccountContext.Generate();
const db = NewIndexedDB();
if (db instanceof Error) {
    fail(db.message);
}

const database = await Database_View.New(db, db, db);
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
    const err = dm_list.addEvents([event], false);
    if (err instanceof Error) {
        fail(err.message);
    }
}

const otherConfig = OtherConfig.Empty(ctx, new LamportTime());

const view = () =>
    render(
        <ConversationList
            getters={{
                convoListRetriever: dm_list,
                newMessageChecker: dm_list,
                pinListGetter: otherConfig,
                getProfileByPublicKey: database.getProfileByPublicKey,
                getProfilesByText: database.getProfilesByText,
            }}
            eventSub={testEventBus}
            emit={testEventBus.emit}
            userBlocker={dm_list}
        />,
        document.body,
    );

view();
