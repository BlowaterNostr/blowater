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

const prepareProfileEvent = async (profile: { name?: string; display_name?: string }) => {
    const testProfileEvent2 = await prepareNormalNostrEvent(test_ctx, {
        kind: NostrKind.META_DATA,
        content: JSON.stringify(profile),
    }) as NostrEvent<NostrKind.META_DATA>;
    return {
        ...testProfileEvent2,
        profile,
        publicKey: test_ctx.publicKey,
        parsedTags: {
            p: [],
            e: [],
        },
    };
};
const testProfile1 = { name: "test_name" };
const testProfileEvent1: Profile_Nostr_Event = await prepareProfileEvent(testProfile1);

const testProfile2 = { display_name: "test_display_name" };
const testProfileEvent2: Profile_Nostr_Event = await prepareProfileEvent(testProfile2);

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

function TextBook() {
    return (
        <div class="w-screen h-screen flex-col items-center justify-center gap-2">
            <EditorTest />
            <EditorTest defaultEventId={testEvent.id} />
            <EditorTest defaultEventId={testEvent.id} profileEvent={testProfileEvent1} />
            <EditorTest defaultEventId={testEvent.id} profileEvent={testProfileEvent2} />
        </div>
    );
}

type Props = {
    defaultEventId?: string;
    profileEvent?: Profile_Nostr_Event;
};

function EditorTest(props: Props) {
    const { defaultEventId, profileEvent } = props;

    const testGetProfilesByPublicKey = (pubkey: PublicKey) => {
        if (pubkey === test_ctx.publicKey) {
            return profileEvent;
        }
    };
    const testGetEventByID = (id: string | NoteID) => {
        if (id === testEvent.id) {
            return testParsedEvent;
        }
    };

    if (!testEvent || testEvent instanceof Error) {
        fail();
    }

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
            getters={{
                getProfileByPublicKey: testGetProfilesByPublicKey,
                getEventByID: testGetEventByID,
            }}
        />
    );
}

render(<TextBook />, document.body);
