/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PrivateKey, PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { InMemoryAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { EventDetailItem, EventDetail } from "./event-detail.tsx";


const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const event = await prepareNormalNostrEvent(ctx, {
    kind: NostrKind.TEXT_NOTE,
    tags: [["d", "nostr"]],
    content: "Pura Vida"
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
