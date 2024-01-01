/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { NoteCard } from "./note-card.tsx";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../../lib/nostr-ts/event.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { parseJSON } from "../features/profile.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { originalEventToUnencryptedEvent, parseDM } from "../database.ts";
import { getTags } from "../nostr.ts";

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

const decryptDMEvent = await parseDM(
    DMEvent,
    ctx,
    getTags(DMEvent),
    ctx.publicKey,
    testEventsAdapter,
);
if (decryptDMEvent instanceof Error) fail(decryptDMEvent.message);
if (decryptDMEvent == false) fail();

const parsedSocialEvent = originalEventToUnencryptedEvent(socialEvent, getTags(socialEvent), ctx.publicKey);
if (parsedSocialEvent instanceof Error) fail(parsedSocialEvent.message);

const profileData = parseJSON(profileEvent.content);
if (profileData instanceof Error) fail(profileData.message);

render(
    <Fragment>
        <NoteCard
            profileData={profileData}
            // @ts-ignore
            event={parsedSocialEvent}
            emit={testEventBus.emit}
        />
        <NoteCard
            profileData={profileData}
            // @ts-ignore
            event={decryptDMEvent}
            emit={testEventBus.emit}
        />
    </Fragment>,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
