/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { NoteCard } from "./note-card.tsx";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { parseProfileData } from "../features/profile.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { originalEventToParsedEvent } from "../database.ts";
import { DirectedMessage_Event, Text_Note_Event } from "../nostr.ts";

const privateKey = PrivateKey.Generate();
const ctx = InMemoryAccountContext.New(privateKey);
const socialEvent = await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [["d", "nostr"]], `Edge`);
const profileEvent = await prepareNormalNostrEvent(
    ctx,
    NostrKind.META_DATA,
    [["d", "nostr"]],
    `{"name":"mike"}`,
);
const DMEvent = await prepareEncryptedNostrEvent(ctx, ctx.publicKey, NostrKind.DIRECT_MESSAGE, [[
    "p",
    privateKey.toPublicKey().hex,
]], "maybe we can finish it first");
if (DMEvent instanceof Error) {
    fail(DMEvent.message);
}
const decryptDMEvent = await originalEventToParsedEvent(DMEvent, ctx, testEventsAdapter);
const decryptSocialEvent = await originalEventToParsedEvent(socialEvent, ctx, testEventsAdapter);
if (decryptSocialEvent instanceof Error) {
    fail(decryptSocialEvent.message);
}

if (decryptDMEvent instanceof Error) {
    fail(decryptDMEvent.message);
}

if (!decryptSocialEvent) {
    fail();
}

if (!decryptDMEvent) {
    fail();
}

const profileData = parseProfileData(profileEvent.content);
if (profileData instanceof Error) {
    fail(profileData.message);
}

render(
    <Fragment>
        <NoteCard
            profileData={profileData}
            event={{
                ...decryptSocialEvent,
                parsedContentItems: (decryptSocialEvent as Text_Note_Event).parsedContentItems,
                kind: NostrKind.TEXT_NOTE,
            }}
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
