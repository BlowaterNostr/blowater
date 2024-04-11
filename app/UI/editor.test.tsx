/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { useState } from "https://esm.sh/preact@10.17.1/hooks";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { getTags, Parsed_Event, Profile_Nostr_Event } from "../nostr.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrEvent } from "../../libs/nostr.ts/nostr.ts";

const test_ctx = InMemoryAccountContext.Generate();
const testProfile = { name: "test" };
const testProfileEvent = await prepareNormalNostrEvent(test_ctx, {
    kind: NostrKind.META_DATA,
    content: JSON.stringify(testProfile),
}) as NostrEvent<NostrKind.META_DATA>;

const testEvent = await prepareEncryptedNostrEvent(test_ctx, {
    encryptKey: test_ctx.publicKey,
    kind: NostrKind.DIRECT_MESSAGE,
    tags: [["p", InMemoryAccountContext.Generate().publicKey.hex]],
    content: "hi",
}) as NostrEvent<NostrKind.DIRECT_MESSAGE>;

const testParsedEvent: Parsed_Event = {
    ...testEvent,
    parsedTags: getTags(testEvent),
    publicKey: test_ctx.publicKey,
};

const testProfileNostrEvent: Profile_Nostr_Event = {
    ...testProfileEvent,
    profile: testProfile,
    publicKey: test_ctx.publicKey,
    parsedTags: {
        p: [],
        e: [],
    },
};

const testGetProfilesByPublicKey = (pubkey: PublicKey) => {
    if (pubkey === test_ctx.publicKey) {
        return testProfileNostrEvent;
    }
    return undefined;
};
const testGetEventByID = (id: string | NoteID) => {
    if (id === testEvent.id) {
        return testParsedEvent;
    }
    return undefined;
};

function TextBook() {
    return (
        <div class="w-screen h-screen flex-col items-center justify-center gap-2">
            <EditorTest />
            <EditorTest defaultEventId={testEvent.id} />
            <EditorTest defaultEventId={testEvent.id} defalutText={`hello world`} />
        </div>
    );
}

type Props = {
    defaultEventId?: string;
    defalutText?: string;
};

function EditorTest(props: Props) {
    if (!testEvent || testEvent instanceof Error) {
        fail();
    }

    const { defaultEventId } = props;

    const [eventID, setEventID] = useState<string | NoteID | undefined>(defaultEventId);

    return (
        <Editor
            replyTo={{
                eventID: eventID,
                onEventIDChange: (id) => {
                    setEventID(id);
                },
            }}
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
            text={props.defalutText}
            getters={{
                getProfileByPublicKey: testGetProfilesByPublicKey,
                getEventByID: testGetEventByID,
            }}
        />
    );
}

render(<TextBook />, document.body);
