/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { EventSyncer } from "./event_syncer.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { MessageList } from "./message-list.tsx";

const pool = new ConnectionPool();
pool.addRelayURL(relays[2]);
const database = await test_db_view();
const eventSyncer = new EventSyncer(pool, database);

const ctx = InMemoryAccountContext.Generate();
const dmController = new DirectedMessageController(ctx);
const events = [];
for (let i = 1; i <= 3; i++) {
    const event = await prepareEncryptedNostrEvent(ctx, {
        content: `test:${i}`,
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [
            ["p", ctx.publicKey.hex],
        ],
    });
    if (event instanceof Error) fail(event.message);

    events.push(event);
}

await dmController.addEvent(events[0]);
await dmController.addEvent(events[1]);
await dmController.addEvent(events[2]);

const messages = dmController.getChatMessages(ctx.publicKey.hex);
console.log("messages", messages);

render(
    <MessageList
        myPublicKey={ctx.publicKey}
        messages={messages}
        emit={testEventBus.emit}
        eventSyncer={eventSyncer}
        getters={{
            profileGetter: database,
            relayRecordGetter: database,
        }}
    />,
    document.body,
);
