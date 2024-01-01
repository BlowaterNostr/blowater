/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";

import KeyView from "./key-view.tsx";
import { PrivateKey, PublicKey } from "../../libs/nostr.ts/key.ts";

const key = PrivateKey.Generate();

let vdom = (
    <KeyView
        publicKey={key.toPublicKey()}
        privateKey={key}
    />
);
render(vdom, document.body);
