/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { EditGroup } from "./edit-group.tsx";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Database_Contextual_View } from "../database.ts";
import { EditProfile } from "./edit-profile.tsx";

const database = await Database_Contextual_View.New(testEventsAdapter);
if (database instanceof Error) {
    fail(database.message);
}
const ctx = InMemoryAccountContext.Generate();

render(
    <EditProfile
        emit={testEventBus.emit}
        ctx={ctx}
        profileGetter={database}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
