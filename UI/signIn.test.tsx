/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { testEventBus } from "./_setup.test.ts";
import { SignIn } from "./signIn.tsx";

render(
    <SignIn
        emit={testEventBus.emit}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
