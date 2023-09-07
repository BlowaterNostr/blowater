/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { eventBus } from "./_setup.test.ts";
import { SignIn } from "./signIn.tsx";

render(
    <SignIn
        eventBus={eventBus}
        privateKey={PrivateKey.Generate().hex}
    />,
    document.body,
);

for await (const e of eventBus.onChange()) {
    console.log(e);
}
