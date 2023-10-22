/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { MessagePanel } from "./message-panel.tsx";
import { InvalidKey, PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { DM_List } from "./conversation-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { handle_SendMessage } from "./app_update.tsx";
import { LamportTime } from "../time.ts";
import { initialModel } from "./app_model.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const database = await Database_Contextual_View.New(testEventsAdapter, ctx);
if (database instanceof InvalidKey) fail(database.message);
const lamport = new LamportTime(0);

await database.addEvent(await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [], `hi`));
await database.addEvent(await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [], `hi 2`));
await database.addEvent(await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [], `hi 3`));
const allUserInfo = new DM_List(ctx, new ProfileSyncer(database, new ConnectionPool()));
const pool = new ConnectionPool();
const model = initialModel();
pool.addRelayURL(relays[0]);

const editor = model.dmEditors.get(ctx.publicKey.hex);

const view = () => {
    if (editor == undefined) {
        return undefined;
    }
    return (
        <MessagePanel
            allUserInfo={allUserInfo.convoSummaries}
            /**
             * If we use a map to store all editor models,
             * need to distinguish editor models for DMs and GMs
             */
            editorModel={editor}
            eventSyncer={new EventSyncer(pool, database)}
            focusedContent={undefined}
            myPublicKey={ctx.publicKey}
            profilesSyncer={new ProfileSyncer(database, pool)}
            emit={testEventBus.emit}
            messages={[]}
            rightPanelModel={{
                show: true,
            }}
            isGroupChat={false}
        />
    );
};

render(view(), document.body);

for await (const e of testEventBus.onChange()) {
    console.log(e);
    if (e.type == "SendMessage") {
        const err = await handle_SendMessage(
            e,
            ctx,
            lamport,
            pool,
            model.dmEditors,
            database,
        );
        if (err instanceof Error) {
            console.error("update:SendMessage", err);
            continue; // todo: global error toast
        }
    } else if (e.type == "UpdateEditorText") {
    }
    render(view(), document.body);
}
