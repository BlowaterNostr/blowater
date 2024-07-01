/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareNormalNostrEvent } from "@blowater/nostr-sdkevent.ts";
import { PrivateKey, PublicKey } from "@blowater/nostr-sdk";
import { NoteID } from "@blowater/nostr-sdknip19.ts";
import { InMemoryAccountContext, NostrKind } from "@blowater/nostr-sdk";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const event = await prepareNormalNostrEvent(ctx, {
    kind: NostrKind.TEXT_NOTE,
    tags: [["d", "nostr"]],
    content: "Pura Vida",
});
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
