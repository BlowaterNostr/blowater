/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";

import { NewIndexedDB } from "./dexie-db.ts";
import { MessagePanel } from "./message-panel.tsx";
import { EventBus } from "../event-bus.ts";
import { PrivateKey, PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ChatMessage } from "./message.ts";

// const myPrivateKey = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
// const myPublicKey = toPublicKey(myPrivateKey);

const database = await NewIndexedDB();
if (database instanceof Error) {
    throw database;
}

// const contactPubkeys = await database.getContactPubkeysOf(myPublicKey);
// if (contactPubkeys instanceof Error) {
//     throw contactPubkeys;
// }

// Get all of my messages
// const events = await database.getDirectMessageEventsOf(myPublicKey);

// const msgs = await convertEventsToChatMessages(events, database);

const messages: ChatMessage[] = [];
for (let i = 0; i < 10000; i++) {
    messages.push({
        // don't care event value
        event: {
            content: "",
            created_at: 1,
            id: "",
            kind: 1,
            pubkey: "",
            sig: "",
            tags: [],
        },
        type: "text",
        content: `${i}`,
        created_at: new Date(Date.now()),
        author: {
            pubkey: PrivateKey.Generate().toPublicKey(),
            name: "",
            picture: "",
        },
        lamport: undefined,
    });
}

let vdom = (
    <MessagePanel
        selectedThreadRoot={undefined}
        targetUserProfile={{
            name: "test user",
        }}
        editorModel={{
            files: [],
            text: "",
            target: {
                kind: NostrKind.DIRECT_MESSAGE,
                receiver: {
                    pubkey: PrivateKey.Generate().toPublicKey(),
                    name: "",
                    picture: "",
                },
            },
        }}
        eventEmitter={new EventBus()}
        myPublicKey={PrivateKey.Generate()}
        messages={[
            {
                replies: messages.slice(1),
                root: messages[0],
            },
        ]}
        rightPanelModel={{
            show: true,
        }}
    />
);

render(vdom, document.body);
