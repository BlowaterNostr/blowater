/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey, PublicKey } from "../../0_lib/nostr-ts/key.ts";
import { prepareNormalNostrEvent } from "../../lib/nostr-ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../../0_lib/nostr-ts/nostr.ts";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { NoteID } from "../../lib/nostr-ts/nip19.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const event = await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [["d", "nostr"]], "Pura Vida");
const publicKey = PublicKey.FromHex(event.pubkey) as PublicKey;

const items: EventDetailItem[] = [
    {
        title: "Event ID",
        fields: [
            event.id,
            NoteID.FromString(event.id).bech32(),
        ],
    },
    {
        title: "Author",
        fields: [
            publicKey.hex,
            publicKey.bech32(),
        ],
    },
    {
        title: "Content",
        fields: [
            event.content,
            JSON.stringify(event, null, 4),
        ],
    },
];

render(
    <EventDetail items={items} />,
    document.body,
);
