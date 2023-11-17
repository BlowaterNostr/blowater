/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { NavBar } from "./nav.tsx";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { Datebase_View } from "../database.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { testEventBus, testEventsAdapter, testRelayAdapter, testRemovedAdapter } from "./_setup.test.ts";
import { tw } from "https://esm.sh/twind@0.16.16";

const db = await Datebase_View.New(testEventsAdapter, testRelayAdapter, testRemovedAdapter);

const ctx = InMemoryAccountContext.Generate();

render(
    <div class={tw`h-screen`}>
        <NavBar emit={testEventBus.emit} publicKey={ctx.publicKey} profileGetter={db} />
        <NavBar emit={testEventBus.emit} publicKey={ctx.publicKey} profileGetter={db} isMobile={true} />
    </div>,
    document.body,
);

for await (const event of testEventBus.onChange()) {
    console.log(event);
}
