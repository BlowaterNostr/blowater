/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { testEventBus } from "./_setup.test.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());

let vdom = (
    <Editor
        placeholder="Message @xxx"
        maxHeight="50vh"
        eventEmitter={testEventBus}
        model={{
            files: [],
            id: "",
            tags: [],
            target: {
                kind: NostrKind.DIRECT_MESSAGE,
                receiver: {
                    pubkey: ctx.publicKey,
                },
            },
            text: "",
        }}
    />
);
render(vdom, document.body);
