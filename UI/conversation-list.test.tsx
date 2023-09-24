/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ConversationList } from "./conversation-list.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Database_Contextual_View } from "../database.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { testEventBus } from "./_setup.test.ts";
import { initialModel } from "./app_model.ts";
import { ConversationLists } from "./conversation-list.ts";
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

const convoLists = new ConversationLists(ctx);
convoLists.addEvents(database.events);

const model = initialModel();
model.dm.selectedContactGroup = "Strangers";
model.dm.currentSelectedContact = ctx.publicKey;

const view = () =>
    render(
        <ConversationList
            convoListRetriever={convoLists}
            currentSelected={model.dm.currentSelectedContact}
            hasNewMessages={new Set()}
            selectedContactGroup={model.dm.selectedContactGroup}
            // common dependencies
            emit={testEventBus.emit}
        />,
        document.body,
    );

view();
for await (const e of testEventBus.onChange()) {
    console.log(e);
    if (e.type == "SelectConversation") {
        model.dm.currentSelectedContact = e.pubkey;
    } else if (e.type == "SelectConversationType") {
        model.dm.selectedContactGroup = e.group;
    }
    view();
}
