/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { eventBus } from "./_setup.test.ts";
import { SignIn } from "./signIn.tsx";
import { useState } from "https://esm.sh/stable/preact@10.17.1/hooks";


function X() {
    const [x, s] = useState(0)
    return <p>{x}</p>
}

render(
    // SignIn({
    //     eventBus: eventBus,
    //     state: "enterPrivateKey",
    //     privateKey: PrivateKey.Generate().bech32,
    // }),
    X(),
    document.body,
);

for await (const e of eventBus.onChange()) {
    console.log(e);
}
