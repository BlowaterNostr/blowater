/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { parseProfileData } from "../features/profile.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { ProfileCard } from "./profile-card.tsx";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { testEventBus } from "./_setup.test.ts";

const privateKey = PrivateKey.Generate();
const publicKey = privateKey.toPublicKey();
const ctx = InMemoryAccountContext.New(privateKey);
const profileEvent = await prepareNormalNostrEvent(
    ctx,
    NostrKind.META_DATA,
    [["d", "nostr"]],
    `{"name":"mike", "about": "a test man"}`,
);

const profileData = parseProfileData(profileEvent.content);
if (profileData instanceof Error) {
    fail(profileData.message);
}

render(
    <Fragment>
        <ProfileCard publicKey={publicKey} profileData={profileData} emit={testEventBus.emit} />
    </Fragment>,
    document.body,
);
