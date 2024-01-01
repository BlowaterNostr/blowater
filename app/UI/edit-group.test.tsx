/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { testEventBus, testEventMarker, testEventsAdapter, testRelayAdapter } from "./_setup.test.ts";
import { EditGroup } from "./edit-group.tsx";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Datebase_View } from "../database.ts";

const database = await test_db_view();

const ctx = InMemoryAccountContext.Generate();

render(
    <EditGroup
        emit={testEventBus.emit}
        ctx={ctx}
        profileGetter={database}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
