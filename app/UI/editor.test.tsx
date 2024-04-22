/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { getTags, Parsed_Event, Profile_Nostr_Event } from "../nostr.ts";
import { NostrEvent } from "../../libs/nostr.ts/nostr.ts";

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

const prepareProfileEvent = async (profile: { name?: string; display_name?: string }) => {
    const profileEvent = await prepareNormalNostrEvent(author, {
        kind: NostrKind.META_DATA,
        content: JSON.stringify(profile),
    }) as NostrEvent<NostrKind.META_DATA>;
    return {
        ...profileEvent,
        profile,
        publicKey: author.publicKey,
        parsedTags: {
            p: [],
            e: [],
        },
    } as Profile_Nostr_Event;
};

const onlyName = await prepareProfileEvent({ name: "test_name" });
const onlyDisplayName = await prepareProfileEvent({ display_name: "test_display_name" });
const empty = await prepareProfileEvent({});

function TextBook() {
    return (
        <div class="w-screen h-screen flex-col items-center justify-center gap-2">
            <EditorTest />
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
        />
    );
}

render(<TextBook />, document.body);
