/** @jsx h */
import { h, render } from "preact";
import { Editor } from "./editor.tsx";
import { prepareProfileEvent, testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext, NostrKind } from "@blowater/nostr-sdk";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "@blowater/nostr-sdk";
import { getTags, Parsed_Event, Profile_Nostr_Event } from "../nostr.ts";
import { NostrEvent } from "@blowater/nostr-sdk";

const author = InMemoryAccountContext.Generate();

const event = await prepareEncryptedNostrEvent(author, {
    encryptKey: author.publicKey,
    kind: NostrKind.DIRECT_MESSAGE,
    tags: [["p", InMemoryAccountContext.Generate().publicKey.hex]],
    content: "hi",
}) as NostrEvent<NostrKind.DIRECT_MESSAGE>;

const parsedEvent: Parsed_Event = {
    ...event,
    parsedTags: getTags(event),
    publicKey: author.publicKey,
};

const onlyName = await prepareProfileEvent(author, { name: "test_name" });
const onlyDisplayName = await prepareProfileEvent(author, { display_name: "test_display_name" });
const empty = await prepareProfileEvent(author, {});

function TextBook() {
    return (
        <div class="w-screen h-screen flex-col items-center justify-center gap-2">
            <EditorTest />
            <EditorTest nip96 />
            <EditorTest profileEvent={onlyName} />
            <EditorTest profileEvent={onlyDisplayName} />
            <EditorTest profileEvent={empty} />
        </div>
    );
}

testEventBus.emit({
    type: "ReplyToMessage",
    event: parsedEvent,
});

function EditorTest(props: {
    profileEvent?: Profile_Nostr_Event;
    nip96?: boolean;
}) {
    const { profileEvent } = props;

    return (
        <Editor
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
            sub={testEventBus}
            getters={{
                getProfileByPublicKey: () => profileEvent,
                getProfilesByText: () => [onlyName, onlyDisplayName, empty],
            }}
            nip96={props.nip96}
        />
    );
}

render(<TextBook />, document.body);
