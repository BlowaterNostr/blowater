/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PlainTextEventDetail } from "./plain-text-event-detail.tsx";
import { PrivateKey, PublicKey } from "../lib/nostr-ts/key.ts";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { getTags } from "../nostr.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const event = await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [["d", "nostr"]], "Pura Vida");

render(
    <PlainTextEventDetail
        event={{
            ...event,
            parsedTags: getTags(event),
            publicKey: PublicKey.FromHex(event.pubkey) as PublicKey,
        }}
    />,
    document.body,
);
