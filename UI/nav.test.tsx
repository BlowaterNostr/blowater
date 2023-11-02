/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { NavBar } from "./nav.tsx";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { tw } from "https://esm.sh/twind@0.16.16";

const db = await Database_Contextual_View.New(testEventsAdapter);
if (db instanceof Error) fail(db.message);
const ctx = InMemoryAccountContext.Generate();

render(
    <div class={tw`h-screen`}>
        <NavBar emit={testEventBus.emit} publicKey={ctx.publicKey} profileGetter={db} />
    </div>,
    document.body,
);

for await (const event of testEventBus.onChange()) {
    console.log(event);
}
