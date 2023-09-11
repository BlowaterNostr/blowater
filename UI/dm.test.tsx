/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { getSocialPosts } from "../features/social.ts";
import { AllUsersInformation } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { ProfilesSyncer } from "../features/profile.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { LamportTime } from "../time.ts";
import { initialModel } from "./app_model.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const database = await Database_Contextual_View.New(testEventsAdapter, ctx);
const lamport = new LamportTime(0);

const e = await database.addEvent(
    await prepareEncryptedNostrEvent(ctx, ctx.publicKey, NostrKind.DIRECT_MESSAGE, [
        ["p", ctx.publicKey.hex],
    ], "hi") as NostrEvent,
);
if (!e) {
    fail();
}

const allUserInfo = new AllUsersInformation(ctx);
allUserInfo.addEvents([e]);
const pool = new ConnectionPool();
const model = initialModel();
model.dm.currentSelectedContact = ctx.publicKey;
model.editors.set(ctx.publicKey.hex, {
    files: [],
    id: ctx.publicKey.hex,
    tags: [["p", ctx.publicKey.hex]],
    target: {
        kind: NostrKind.DIRECT_MESSAGE,
        receiver: {
            pubkey: ctx.publicKey,
        },
    },
    text: "",
});

pool.addRelayURL(relays[0]);

const view = () => {
    const threads = getSocialPosts(database, allUserInfo.userInfos);
    console.log(database.events, threads);
    return (
        <DirectMessageContainer
            allUserInfo={allUserInfo.userInfos}
            db={database}
            eventSyncer={new EventSyncer(pool, database)}
            profilesSyncer={new ProfilesSyncer(database, pool)}
            eventEmitter={testEventBus}
            rightPanelModel={{
                show: true,
            }}
            editors={model.editors}
            currentSelectedContact={model.dm.currentSelectedContact}
            focusedContent={model.dm.focusedContent}
            hasNewMessages={model.dm.hasNewMessages}
            myAccountContext={ctx}
            pool={pool}
            search={model.dm.search}
            selectedContactGroup={model.dm.selectedContactGroup}
        />
    );
};

render(view(), document.body);

(async () => {
    for await (const evnet of database.subscribe()) {
        allUserInfo.addEvents([evnet]);
    }
})();

for await (const e of testEventBus.onChange()) {
    console.log(e);
    if (e.type == "SendMessage") {
        const err = await handle_SendMessage(
            e,
            ctx,
            lamport,
            pool,
            model.editors,
            model.social.editor,
            model.social.replyEditors,
            database,
        );
        if (err instanceof Error) {
            console.error("update:SendMessage", err);
            continue; // todo: global error toast
        }
    } else if (e.type == "UpdateMessageText") {
        const event = e;
        if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
            const editor = model.editors.get(event.id);
            if (editor) {
                editor.text = event.text;
            } else {
                console.log(event.target.receiver, event.id);
                throw new Error("impossible state");
            }
        } else {
            if (event.id == "social") {
                model.social.editor.text = event.text;
            } else {
                const editor = model.social.replyEditors.get(event.id);
                if (editor) {
                    editor.text = event.text;
                } else {
                    throw new Error("impossible state");
                }
            }
        }
    }
    render(view(), document.body);
}
