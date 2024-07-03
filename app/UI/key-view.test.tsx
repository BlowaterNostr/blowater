/** @jsx h */
import { h, render } from "preact";

import KeyView from "./key-view.tsx";
import { PrivateKey, PublicKey } from "@blowater/nostr-sdk";

const key = PrivateKey.Generate();

let vdom = (
    <KeyView
        publicKey={key.toPublicKey()}
        privateKey={key}
    />
);
render(vdom, document.body);
