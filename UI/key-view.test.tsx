/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";

import KeyView from "./key-view.tsx";
import { PrivateKey, PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

const key = PrivateKey.Generate();

let vdom = (
    <KeyView
        publicKey={key.toPublicKey()}
        privateKey={key}
    />
);
render(vdom, document.body);
