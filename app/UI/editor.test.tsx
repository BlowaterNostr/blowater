/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { Database_View } from "../database.ts";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { NostrEvent } from "../../libs/nostr.ts/nostr.ts";

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Database_View.New(indexedDB, indexedDB, indexedDB);

const ctx = InMemoryAccountContext.Generate();
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

let vdom = (
    <div class="border">
        <Editor
            replyToEventID={e.id}
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
            getters={{
                profileGetter: database,
                getEventByID: database.getEventByID,
            }}
        />
    </div>
);
render(vdom, document.body);
