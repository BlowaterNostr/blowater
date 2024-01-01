/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { testEventBus } from "./_setup.test.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());

let vdom = (
    <div class="border">
        <Editor
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
            files={[]}
            isGroupChat={false}
            targetNpub={ctx.publicKey}
            text="This is a test"
        />
    </div>
);
render(vdom, document.body);
