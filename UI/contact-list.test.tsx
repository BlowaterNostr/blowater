/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ConversationList } from "./contact-list.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Database_Contextual_View } from "../database.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { initialModel } from "./app_model.ts";
import { AllUsersInformation } from "./contact-list.ts";
import { ProfilesSyncer } from "../features/profile.ts";
import { NewIndexedDB } from "./dexie-db.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const db = NewIndexedDB();
if (db instanceof Error) {
    fail(db.message);
}
const database = await Database_Contextual_View.New(db, ctx);
if (database instanceof Error) {
    fail(database.message);
}

const allUserInfo = new AllUsersInformation(ctx);
allUserInfo.addEvents(database.events);

console.log(Array.from(allUserInfo.getStrangers()).length);

const model = initialModel();
model.dm.selectedContactGroup = "Strangers";
render(
    <ConversationList
        convoListRetriever={allUserInfo}
        currentSelected={ctx.publicKey}
        hasNewMessages={new Set()}
        selectedContactGroup={model.dm.selectedContactGroup}
        // common dependencies
        emit={testEventBus.emit}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
