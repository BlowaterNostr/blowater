/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { NoteID } from "../lib/nostr-ts/nip19.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const event = await prepareNormalNostrEvent(ctx, NostrKind.TEXT_NOTE, [["d", "nostr"]], "Pura Vida");

const eventID = event.id;
const eventIDBech32 = NoteID.FromString(event.id).bech32();
const authorPubkey = ctx.publicKey.hex;
const authorPubkeyBech32 = ctx.publicKey.bech32();
const content = event.content;
const originalEventRaw = JSON.stringify(
    {
        content: event.content,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        pubkey: event.pubkey,
        id: event.id,
        sig: event.sig,
    },
    null,
    4,
);

const items: EventDetailItem[] = [
    {
        title: "Event ID",
        fields: [
            eventID,
            eventIDBech32,
        ],
    },
    {
        title: "Author",
        fields: [
            authorPubkey,
            authorPubkeyBech32,
        ],
    },
    {
        title: "Content",
        fields: [
            content,
            originalEventRaw,
        ],
    },
];

render(
    <EventDetail items={items}/>,
    document.body,
);
