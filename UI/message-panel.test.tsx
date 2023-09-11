/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { MessagePanel } from "./message-panel.tsx";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { getSocialPosts } from "../features/social.ts";
import { AllUsersInformation } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { ProfilesSyncer } from "../features/profile.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { LamportTime } from "../time.ts";
import { initialModel } from "./app_model.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const database = await Database_Contextual_View.New(testEventsAdapter, ctx);
const lamport = new LamportTime(0)

await database.addEvent(await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [], `hi`));
await database.addEvent(await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [], `hi 2`));
await database.addEvent(await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [], `hi 3`));
const allUserInfo = new AllUsersInformation(ctx);
const threads = getSocialPosts(database, allUserInfo.userInfos);
console.log(database.events, threads);
const pool = new ConnectionPool();

let vdom = (
    <MessagePanel
        allUserInfo={allUserInfo.userInfos}
        db={database}
        editorModel={{
            files: [],
            id: "",
            tags: [],
            target: {
                kind: NostrKind.TEXT_NOTE,
            },
            text: "",
        }}
        eventSyncer={new EventSyncer(pool, database)}
        focusedContent={{
            editor: {
                files: [],
                id: "",
                tags: [],
                target: {
                    kind: NostrKind.TEXT_NOTE,
                },
                text: "",
            },
            type: "MessageThread",
            data: threads[0],
        }}
        myPublicKey={ctx.publicKey}
        profilesSyncer={new ProfilesSyncer(database, pool)}
        eventEmitter={testEventBus}
        messages={threads}
        rightPanelModel={{
            show: true,
        }}
    />
);

render(vdom, document.body);
const model = initialModel()
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
        );
        if (err instanceof Error) {
            console.error("update:SendMessage", err);
            continue; // todo: global error toast
        }
    }
}
