/*
    Extension to common Nostr types
*/
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import * as nostr from "./lib/nostr-ts/nostr.ts";
import { groupBy, NostrKind, TagPubKey } from "./lib/nostr-ts/nostr.ts";
import { ProfileData } from "./features/profile.ts";
import { ContentItem } from "./UI/message.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "./lib/nostr-ts/event.ts";

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

type Tags = {
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

export type UnpinConversation = {
    type: "UnpinConversation";
    pubkey: string;
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
    tags?: Tag[],
): Promise<[nostr.NostrEvent, string] | Error> {
    // prepare nostr event
    // read the blob
    const binaryContent = await nostr.blobToBase64(blob);

    const limit = 64 * 1024;
    if (binaryContent.length > limit) {
        return new Error(`content size ${binaryContent.length} > limit ${limit}`);
    }

    const encrypted = await sender.encrypt(receiverPublicKey.hex, binaryContent);
    if (encrypted instanceof Error) {
        return encrypted;
    }

    const GroupLeadEventID = PrivateKey.Generate().hex;
    const event: nostr.UnsignedNostrEvent = {
        created_at: Math.floor(Date.now() / 1000),
        kind: kind,
        pubkey: sender.publicKey.hex,
        tags: [
            ["p", receiverPublicKey.hex],
            ["image", GroupLeadEventID, "1", "0"],
            ...(tags || []),
        ],
        content: encrypted,
    };
    const signedEvent = await sender.signEvent(event);
    return [signedEvent, GroupLeadEventID];
}

export function reassembleBase64ImageFromEvents(
    events: nostr.NostrEvent[],
) {
    if (events.length === 0) {
        return "";
    }

    const firstEvent = events[0];
    const imageTag = getTags(firstEvent).image;
    if (imageTag == undefined) {
        return new Error(`${firstEvent.id} is not an image event`);
    }

    const [_2, chunkCount, _4] = imageTag;
    const chunks = new Array<string | null>(Number(chunkCount));
    chunks.fill(null);

    for (const event of events) {
        const imageTag = getTags(event).image;
        if (imageTag == undefined) {
            return new Error(`${event.id} is not an image event`);
        }
        const [_2, _3, chunkIndex] = imageTag;
        const cIndex = Number(chunkIndex);
        chunks[cIndex] = event.content;
    }

    if (chunks.includes(null)) {
        const miss = chunks.filter((c) => c === null).length;
        return new Error(
            `not enough chunks for image event ${firstEvent.id}, need ${Number(chunkCount)}, miss ${miss}`,
        );
    }
    return chunks.join("");
}

export function groupImageEvents<T extends Parsed_Event>(events: Iterable<T>) {
    return groupBy(events, (event) => {
        const tags = event.parsedTags;
        const imageTag = tags.image;
        if (imageTag == undefined) {
            return undefined;
        }
        const groupID = imageTag[0];
        return groupID;
    });
}

export async function prepareReplyEvent(
    sender: nostr.NostrAccountContext,
    targetEvent: nostr.NostrEvent,
    tags: Tag[],
    content: string,
): Promise<nostr.NostrEvent | Error> {
    const ps = getTags(targetEvent).p;
    if (targetEvent.kind == NostrKind.DIRECT_MESSAGE) {
        const replyTo = PublicKey.FromHex(targetEvent.pubkey);
        if (replyTo instanceof Error) {
            return replyTo;
        }
        return prepareEncryptedNostrEvent(
            sender,
            {
                encryptKey: replyTo,
                kind: targetEvent.kind,
                tags: [
                    [
                        "e",
                        targetEvent.id,
                        "",
                        "reply",
                    ],
                    ...ps.map((p) =>
                        [
                            "p",
                            p,
                        ] as TagPubKey
                    ),
                    ...tags,
                ],
                content,
            },
        );
    }

    return prepareNormalNostrEvent(
        sender,
        targetEvent.kind,
        [
            [
                "e",
                targetEvent.id,
                "",
                "reply",
            ],
            ...ps.map((p) =>
                [
                    "p",
                    p,
                ] as TagPubKey
            ),
            ...tags,
        ],
        content,
    );
}

export function compare(a: parsedTagsEvent, b: parsedTagsEvent) {
    if (a.parsedTags.lamport_timestamp && b.parsedTags.lamport_timestamp) {
        return a.parsedTags.lamport_timestamp - b.parsedTags.lamport_timestamp;
    }
    return a.created_at - b.created_at;
}
