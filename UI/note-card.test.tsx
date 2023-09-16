/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { NoteCard } from "./note-card.tsx";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { parseProfileData } from "../features/profile.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { originalEventToParsedEvent, originalEventToUnencryptedEvent } from "../database.ts";
import { DirectedMessage_Event, getTags } from "../nostr.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const socialEvent = await prepareNormalNostrEvent<NostrKind.TEXT_NOTE>(
    ctx,
    NostrKind.TEXT_NOTE,
    [],
    `Edge`,
);
const profileEvent = await prepareNormalNostrEvent(
    ctx,
    NostrKind.META_DATA,
    [],
    `{"name":"mike"}`,
);
const DMEvent = await prepareEncryptedNostrEvent(
    ctx,
    ctx.publicKey,
    NostrKind.DIRECT_MESSAGE,
    [
        [
            "p",
            ctx.publicKey.hex,
        ],
    ],
    "maybe we can finish it first",
);
if (DMEvent instanceof Error) fail(DMEvent.message);

const decryptDMEvent = await originalEventToParsedEvent(DMEvent, ctx, testEventsAdapter);
if (decryptDMEvent instanceof Error) fail(decryptDMEvent.message);
if (decryptDMEvent == false) fail();

const decryptSocialEvent = originalEventToUnencryptedEvent(socialEvent, getTags(socialEvent), ctx.publicKey);
if (decryptSocialEvent instanceof Error) fail(decryptSocialEvent.message);

const profileData = parseProfileData(profileEvent.content);
if (profileData instanceof Error) fail(profileData.message);

render(
    <Fragment>
        <NoteCard
            profileData={profileData}
            // @ts-ignore
            event={decryptSocialEvent}
            emit={testEventBus.emit}
        />
        <NoteCard
            profileData={profileData}
            event={{
                ...decryptDMEvent,
                parsedContentItems: (decryptDMEvent as DirectedMessage_Event).parsedContentItems,
                kind: NostrKind.DIRECT_MESSAGE,
                decryptedContent: (decryptDMEvent as DirectedMessage_Event).decryptedContent,
            }}
            emit={testEventBus.emit}
        />
    </Fragment>,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
