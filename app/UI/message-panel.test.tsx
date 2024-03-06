/** @jsx h */
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { LamportTime } from "../time.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { EventSyncer } from "./event_syncer.ts";
import { DirectedMessageController } from "../features/dm.ts";
import { DM_List } from "./conversation-list.ts";

import { handle_SendMessage } from "./app_update.tsx";
import { MessagePanel } from "./message-panel.tsx";

const lamport = new LamportTime();
const pool = new ConnectionPool();
pool.addRelayURL(relays[2]);
const database = await test_db_view();
const eventSyncer = new EventSyncer(pool, database);

const ctx = InMemoryAccountContext.Generate();
const dmController = new DirectedMessageController(ctx);

for (let i = 1; i <= 50; i++) {
    const event = await prepareEncryptedNostrEvent(ctx, {
        content: `test pre:${i}`,
        encryptKey: ctx.publicKey,
        kind: NostrKind.DIRECT_MESSAGE,
        tags: [
            ["p", ctx.publicKey.hex],
            ["lamport", lamport.now().toString()],
        ],
    });
    if (event instanceof Error) fail(event.message);

    const err = await dmController.addEvent(event);
    if (err instanceof Error) {
        fail(err.message);
    }
}

for (let i = 1; i <= 200; i++) {
    setTimeout(async () => {
        const event = await prepareEncryptedNostrEvent(ctx, {
            content: `test:${i} ${new Date().toISOString()}`,
            encryptKey: ctx.publicKey,
            kind: NostrKind.DIRECT_MESSAGE,
            tags: [
                ["p", ctx.publicKey.hex],
                ["lamport", lamport.now().toString()],
            ],
        });
        if (event instanceof Error) fail(event.message);

        const err = await dmController.addEvent(event);
        if (err instanceof Error) {
            fail(err.message);
        }
        console.log("added event", i);
        const messages = dmController.getChatMessages(ctx.publicKey.hex);
        const view = () => {
            return (
                <div class="w-screen h-screen">
                    <MessagePanel
                        getters={{
                            profileGetter: database,
                            relayRecordGetter: database,
                            isUserBlocked: new DM_List(ctx).isUserBlocked,
                        }}
                        eventSyncer={eventSyncer}
                        myPublicKey={ctx.publicKey}
                        emit={testEventBus.emit}
                        eventSub={testEventBus}
                        messages={messages}
                    />
                </div>
            );
        };
        render(view(), document.body);
    }, i * getRandomFloat(1000, 12000));
}

function getRandomFloat(min: number, max: number) {
    return Math.random() * (max - min) + min;
}
