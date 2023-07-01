/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";
import { ContactList } from "./contact-list.tsx";

import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";

import { NewIndexedDB } from "./db.ts";
import { EventBus } from "../event-bus.ts";

import { UI_Interaction_Event } from "./app_update.ts";
import { getContactPubkeysOf } from "../features/dm.ts";
import {
    ConnectionPool,
    SingleRelayConnection,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { PrivateKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { InMemoryAccountContext } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { AsyncWebSocket } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/websocket.ts";
import { relays } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay-list.test.ts";

const start = Date.now();

const myPrivateKey = PrivateKey.Generate();
const myPublicKey = PrivateKey.Generate().hex;

const relayPool = new ConnectionPool();
for (let url of relays.slice(0, 1)) {
    const relay = SingleRelayConnection.New(url, AsyncWebSocket.New);
    if (relay instanceof Error) {
        fail(relay.message);
    }
    await relayPool.addRelay(relay);
}

const db = await NewIndexedDB();
if (db instanceof Error) {
    throw db;
}
const contactPubkeys = getContactPubkeysOf(db, myPublicKey);
if (contactPubkeys instanceof Error) {
    throw contactPubkeys;
}

let vdom = (
    <ContactList
        editors={new Map()}
        userInfoMap={new Map()}
        eventEmitter={new EventBus<UI_Interaction_Event>()}
        myAccountContext={InMemoryAccountContext.New(myPrivateKey)}
        database={db}
        search={{
            isSearching: false,
            searchResults: [],
        }}
        selectedContactGroup={"Contacts"}
        hasNewMessages={new Set()}
        currentSelected={undefined}
    />
);
render(vdom, document.body);
console.log("first load", Date.now() - start, "ms");
