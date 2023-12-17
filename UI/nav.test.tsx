/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { NavBar } from "./nav.tsx";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { Datebase_View } from "../database.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { testEventBus, testEventMarker, testEventsAdapter, testRelayAdapter } from "./_setup.test.ts";

const db = await test_db_view();

const ctx = InMemoryAccountContext.Generate();

render(
    <div class={`h-screen`}>
        <NavBar emit={testEventBus.emit} publicKey={ctx.publicKey} profileGetter={db} />
        <NavBar emit={testEventBus.emit} publicKey={ctx.publicKey} profileGetter={db} isMobile={true} />
    </div>,
    document.body,
);

for await (const event of testEventBus.onChange()) {
    console.log(event);
}
