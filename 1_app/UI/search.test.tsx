/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Search } from "./search.tsx";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { Datebase_View } from "../database.ts";
import { InMemoryAccountContext, NostrKind } from "../../0_lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../../0_lib/nostr-ts/key.ts";
import { prepareNormalNostrEvent } from "../../lib/nostr-ts/event.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
await testEventsAdapter.put(await prepareNormalNostrEvent(ctx, NostrKind.META_DATA, [], `{"name":"mike"}`));

const db = await Datebase_View.New(testEventsAdapter, ctx);

render(
    <Search
        placeholder="search for data"
        emit={testEventBus.emit}
        db={db}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
