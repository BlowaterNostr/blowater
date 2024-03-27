/*
    Extension to common Nostr types
*/
import { PublicKey } from "../libs/nostr.ts/key.ts";
import * as nostr from "../libs/nostr.ts/nostr.ts";
import { NostrKind, TagPubKey } from "../libs/nostr.ts/nostr.ts";
import { ProfileData } from "./features/profile.ts";
import { ContentItem } from "./UI/message.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../libs/nostr.ts/event.ts";

type TotolChunks = string;
type ChunkIndex = string; // 0-indexed
type GroupLeadEventID = string;
export type TagImage = ["image", GroupLeadEventID, TotolChunks, ChunkIndex];
export type TagClient = ["client", "blowater"];
export type TagLamportTimestamp = ["lamport", string];
export type TagReply = ["e", nostr.EventID, RelayURL, Marker];
type Marker = "reply" | "root" | "mention";
type RelayURL = string;

export type Tag = nostr.Tag | TagImage | TagClient | TagLamportTimestamp | TagReply;

export type Tags = {
    image?: [GroupLeadEventID, TotolChunks, ChunkIndex];
    lamport_timestamp?: number;
    reply?: [nostr.EventID, RelayURL, "reply"];
    root?: [nostr.EventID, RelayURL, "root"];
} & nostr.Tags;

type Event = nostr.NostrEvent<NostrKind, Tag>;

export type parsedTagsEvent<Kind extends NostrKind = NostrKind> = nostr.NostrEvent<Kind> & {
    readonly parsedTags: Tags;
};

export type Parsed_Event<Kind extends NostrKind = NostrKind> = parsedTagsEvent<Kind> & {
    readonly publicKey: PublicKey;
};

// content is either JSON, encrypted or other format that's should not be rendered directly
export type Encrypted_Kind = NostrKind.DIRECT_MESSAGE;
export type Non_Plain_Text_Kind = Encrypted_Kind | NostrKind.META_DATA;

export type Profile_Nostr_Event = Parsed_Event<NostrKind.META_DATA> & {
    profile: ProfileData;
};

export type DirectedMessage_Event = Parsed_Event<NostrKind.DIRECT_MESSAGE> & {
    decryptedContent: string;
    parsedContentItems: ContentItem[];
};
export type Encrypted_Event = DirectedMessage_Event;

export type CustomAppData = PinConversation | UnpinConversation | UserLogin;

export type PinConversation = {
    type: "PinConversation";
    pubkey: string;
};

export type PinConversationRelay = {
    type: "PinConversation";
    pubkey: string;
    lamport: number;
};

export type UnpinConversation = {
    type: "UnpinConversation";
    pubkey: string;
};

export type UnpinConversationRelay = {
    type: "UnpinConversation";
    pubkey: string;
    lamport: number;
};

export type UserLogin = {
    type: "UserLogin";
};

export function getTags(event: Event): Tags {
    const tags: Tags = {
        p: [],
        e: [],
    };
    for (const tag of event.tags) {
        switch (tag[0]) {
            case "p":
                tags.p.push(tag[1]);
                break;
            case "e":
                if (tag[3] == "reply") {
                    const [_1, EventID, RelayURL, _2] = tag;
                    tags.reply = [EventID, RelayURL as string, "reply"];
                } else if (tag[3] == "root") {
                    const [_1, EventID, RelayURL, _2] = tag;
                    tags.root = [EventID, RelayURL as string, "root"];
                } else if (tag[1] != "") {
                    tags.e.push(tag[1]);
                }
                break;
            case "image":
                const [_, GroupLeadEventID, TotolChunks, ChunkIndex] = tag;
                tags.image = [GroupLeadEventID, TotolChunks, ChunkIndex];
                break;
            case "client":
                tags.client = tag[1];
                break;
            case "lamport":
                tags.lamport_timestamp = Number(tag[1]);
                break;
        }
    }
    return tags;
}

export async function prepareNostrImageEvent(
    sender: nostr.NostrAccountContext,
    receiverPublicKey: PublicKey,
    blob: Blob,
    kind: nostr.NostrKind,
): Promise<nostr.NostrEvent | Error> {
    const binaryContent = await nostr.blobToBase64(blob);
    const encrypted = await sender.encrypt(receiverPublicKey.hex, binaryContent, "nip44");
    if (encrypted instanceof Error) {
        return encrypted;
    }

    const event: nostr.UnsignedNostrEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: kind,
        pubkey: sender.publicKey.hex,
        tags: [
            ["p", receiverPublicKey.hex],
            ["image"],
        ],
        content: encrypted,
    };
    const signedEvent = await sender.signEvent(event);
    return signedEvent;
}

export async function prepareReplyEvent(
    sender: nostr.NostrAccountContext,
    args: {
        targetEvent: nostr.NostrEvent;
        tags: Tag[];
        content: string;
        currentRelay: string;
    },
): Promise<nostr.NostrEvent | Error> {
    const ps = getTags(args.targetEvent).p;
    if (args.targetEvent.kind == NostrKind.DIRECT_MESSAGE) {
        const replyTo = PublicKey.FromHex(args.targetEvent.pubkey);
        if (replyTo instanceof Error) {
            return replyTo;
        }
        return prepareEncryptedNostrEvent(
            sender,
            {
                encryptKey: replyTo,
                kind: args.targetEvent.kind,
                tags: [
                    [
                        "e",
                        args.targetEvent.id,
                        args.currentRelay,
                        "reply",
                    ],
                    ...ps.map((p) =>
                        [
                            "p",
                            p,
                        ] as TagPubKey
                    ),
                    ...args.tags,
                ],
                content: args.content,
            },
        );
    }

    return prepareNormalNostrEvent(
        sender,
        {
            kind: args.targetEvent.kind,
            tags: [
                [
                    "e",
                    args.targetEvent.id,
                    args.currentRelay,
                    "reply",
                ],
                ...ps.map((p) =>
                    [
                        "p",
                        p,
                    ] as TagPubKey
                ),
                ...args.tags,
            ],
            content: args.content,
        },
    );
}

export function compare(a: parsedTagsEvent, b: parsedTagsEvent) {
    if (a.parsedTags.lamport_timestamp && b.parsedTags.lamport_timestamp) {
        return a.parsedTags.lamport_timestamp - b.parsedTags.lamport_timestamp;
    }
    return a.created_at - b.created_at;
}
