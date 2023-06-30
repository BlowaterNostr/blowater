/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";
import { Editor } from "./editor.tsx";
import { EventBus } from "../event-bus.ts";
import { NostrKind } from "../nostr.ts";
import { PublicKey } from "../nip19.ts";

const bus = new EventBus();

let vdom = (
    <Editor
        placeholder="Message @xxx"
        maxHeight="50vh"
        eventEmitter={bus}
        kind={NostrKind.CONTACTS}
        tags={[
            ["p", "1222"],
        ]}
        model={{
            files: [],
            text: "",
        }}
    />
);
render(vdom, document.body);
