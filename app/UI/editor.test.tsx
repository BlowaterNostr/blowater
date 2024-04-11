/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { useState } from "https://esm.sh/preact@10.17.1/hooks";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { Database_View } from "../database.ts";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { NostrEvent } from "../../libs/nostr.ts/nostr.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";

const indexedDB = NewIndexedDB();
if (indexedDB instanceof Error) {
    fail(indexedDB.message);
}
const database = await Database_View.New(indexedDB, indexedDB, indexedDB);

const ctx = InMemoryAccountContext.Generate();
const event = await database.addEvent(
    await prepareEncryptedNostrEvent(ctx, {
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [["p", InMemoryAccountContext.Generate().publicKey.hex]],
        content: "hi",
    }) as NostrEvent,
);

function EditorText() {
    if (!event || event instanceof Error) {
        fail();
    }
    const [eventID, setEventID] = useState<string | NoteID | undefined>(undefined);

    return (
        <div class="w-screen h-screen flex-col items-center justify-center bg-[#36393F]">
            <div class="w-full h-60 flex items-center justify-center">
                <button
                    class="w-20 h-10 rounded px-4 py2 bg-white"
                    onClick={() => setEventID(event.id)}
                >
                    Reply
                </button>
            </div>

            <Editor
                replyTo={{
                    eventID: eventID,
                    onEventIDChange: (id) => {
                        setEventID(id);
                    },
                }}
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
}

render(<EditorText />, document.body);
