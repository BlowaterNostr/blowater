/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ContactList } from "./contact-list.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Database_Contextual_View } from "../database.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { initialModel } from "./app_model.ts";
import { AllUsersInformation } from "./contact-list.ts";
import { ProfilesSyncer } from "../features/profile.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const database = await Database_Contextual_View.New(testEventsAdapter, ctx);
if (database instanceof Error) {
    fail(database.message);
}
const allUserInfo = new AllUsersInformation(ctx);
(async () => {
    for await (const event of database.subscribe()) {
        allUserInfo.addEvents([event]);
    }
})();
database.addEvent(
    await prepareEncryptedNostrEvent(ctx, ctx.publicKey, NostrKind.DIRECT_MESSAGE, [
        ["p", ctx.publicKey.hex],
    ], "123") as NostrEvent,
);

const key = PrivateKey.Generate().toPublicKey();
database.addEvent(
    await prepareEncryptedNostrEvent(ctx, key, NostrKind.DIRECT_MESSAGE, [
        ["p", key.hex],
    ], "123") as NostrEvent,
);

// allUserInfo.addEvents([e]);
const pool = new ConnectionPool();
const model = initialModel();
const profileSyncer = new ProfilesSyncer(database, pool);

render(
    <ContactList
        userInfo={allUserInfo}
        currentSelected={ctx.publicKey}
        hasNewMessages={new Set()}
        selectedContactGroup={model.dm.selectedContactGroup}
        // common dependencies
        myAccountContext={ctx}
        database={database}
        emit={testEventBus.emit}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
