/*
    Extension to common Nostr types
*/
import {
    PrivateKey,
    publicKeyHexFromNpub,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import * as nostr from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import {
    groupBy,
    NostrKind,
    prepareEncryptedNostrEvent,
    prepareNormalNostrEvent,
    TagPubKey,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { decryptDM } from "./features/dm.ts";

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

type UnsignedEvent = nostr.UnsignedNostrEvent<Tag>;

export function getTags(event: nostr.NostrEvent<Tag>): Tags {
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

export async function prepareNostrImageEvents(
    sender: nostr.NostrAccountContext,
    receiverPublicKey: string,
    blob: Blob,
    kind: nostr.NostrKind,
    tags?: Tag[],
): Promise<[nostr.NostrEvent[], string] | Error> {
    // prepare nostr event
    receiverPublicKey = publicKeyHexFromNpub(receiverPublicKey);

    // read the blob
    const binaryContent = await nostr.blobToBase64(blob);

    const chunkSize = 32 * 1024;
    const chunkCount = Math.ceil(binaryContent.length / chunkSize);
    const events: nostr.NostrEvent[] = [];
    let groupLeadEventID = PrivateKey.Generate().hex;
    for (let i = 0; i < chunkCount; i++) {
        const chunk = binaryContent.slice(i * chunkSize, (i + 1) * chunkSize);
        // encryption
        const encrypted = await sender.encrypt(receiverPublicKey, chunk);
        if (encrypted instanceof Error) {
            return encrypted;
        }

        const event: UnsignedEvent = {
            created_at: Math.floor(Date.now() / 1000),
            kind: kind,
            pubkey: sender.publicKey.hex,
            tags: [
                ["p", receiverPublicKey],
                ["image", groupLeadEventID, String(chunkCount), String(i)],
                ...(tags || []),
            ],
            content: encrypted,
        };
        events.push(await sender.signEvent(event));
    }
    return [events, groupLeadEventID];
}

export async function reassembleBase64ImageFromEvents(
    events: nostr.NostrEvent[],
    ctx: nostr.NostrAccountContext,
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
        const decryptedContent = await decryptDM(event, ctx);
        if (decryptedContent instanceof Error) {
            return decryptedContent;
        }
        chunks[cIndex] = decryptedContent;
    }

    if (chunks.includes(null)) {
        const miss = chunks.filter((c) => c === null).length;
        return new Error(
            `not enough chunks for image event ${firstEvent.id}, need ${Number(chunkCount)}, miss ${miss}`,
        );
    }
    return chunks.join("");
}

export function groupImageEvents(events: Iterable<nostr.NostrEvent>) {
    return groupBy(events, (event) => {
        const tags = getTags(event);
        const imageTag = tags.image;
        if (imageTag == undefined) {
            return undefined;
        }
        const groupID = imageTag[0];
        return groupID;
    });
}

export function prepareReplyEvent(
    sender: nostr.NostrAccountContext,
    targetEvent: nostr.NostrEvent,
    tags: Tag[],
    content: string,
): Promise<nostr.NostrEvent | Error> {
    const ps = getTags(targetEvent).p;
    if (targetEvent.kind == NostrKind.DIRECT_MESSAGE) {
        return prepareEncryptedNostrEvent(
            sender,
            targetEvent.pubkey,
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

export function compare(a: nostr.NostrEvent, b: nostr.NostrEvent) {
    // const aTags = getTags(a);
    // const bTags = getTags(b);
    // if (aTags.image && bTags.image) {
    //     if (aTags.image[0] == bTags.image[0]) {
    //         return (Number(aTags.image[2]) - Number(bTags.image[2]));
    //     }
    // }
    // if (aTags.reply && aTags.reply[0] == b.id) {
    //     return 1;
    // }
    // if (bTags.reply && bTags.reply[0] == a.id) {
    //     return -1;
    // }
    // if (aTags.root && aTags.root[0] == b.id) {
    //     return 1;
    // }
    // if (bTags.root && bTags.root[0] == a.id) {
    //     return -1;
    // }
    // if (!aTags.reply && !aTags.root) {
    //     return -1;
    // }
    // if (!bTags.reply && !bTags.root) {
    //     return 1;
    // }
    for (const aTag of a.tags) {
        if (aTag[0] == "lamport") {
            for (const bTag of b.tags) {
                if (bTag[0] == "lamport") {
                    return Number(aTag[1]) - Number(bTag[1]);
                }
            }
        }
    }
    return a.created_at - b.created_at;
}

export function computeThreads(events: nostr.NostrEvent[]) {
    events.sort(compare);
    const idsMap = new Map<string, nostr.NostrEvent>();
    for (const event of events) {
        if (!idsMap.has(event.id)) {
            idsMap.set(event.id, event);
        }
        const tags = getTags(event);
        if (tags.image && tags.image[2] == "0" && !idsMap.has(tags.image[0])) {
            idsMap.set(tags.image[0], event);
        }
    }

    const relationsMap = new Map<nostr.NostrEvent, nostr.NostrEvent | string>();
    for (const event of events) {
        let id = event.id;
        const replyTags = getTags(event).root || getTags(event).reply || getTags(event).e;
        const imageTags = getTags(event).image;
        if (replyTags && replyTags.length > 0) {
            id = replyTags[0];
        } else if (imageTags && imageTags.length > 0) {
            id = imageTags[0];
        }

        const idsEvent = idsMap.get(id);
        if (idsEvent) {
            const relationEvent = relationsMap.get(idsEvent);
            if (!relationEvent) {
                relationsMap.set(event, idsEvent);
            } else {
                relationsMap.set(event, relationEvent);
            }
        } else {
            relationsMap.set(event, id);
        }
    }

    const resMap = new Map<string, nostr.NostrEvent[]>();
    for (const event of events) {
        const relationEvent = relationsMap.get(event);
        if (!relationEvent) {
            throw Error("Impossible");
        }

        const id = typeof relationEvent == "string" ? relationEvent : relationEvent.id;
        const res = resMap.get(id);

        if (res) {
            res.push(event);
        } else {
            resMap.set(id, [event]);
        }
    }

    return Array.from(resMap.values());
}

export interface Signed_CustomAppData_Typed_Event {
    readonly id: nostr.EventID;
    readonly sig: string;
    readonly pubkey: string;
    readonly kind: nostr.NostrKind.CustomAppData;
    readonly created_at: number;
    readonly tags: Tag[];
    readonly content: CustomAppData;
}

export interface Unsigned_CustomAppData_Typed_Event {
    readonly pubkey: string;
    readonly kind: nostr.NostrKind.CustomAppData;
    readonly created_at: number;
    readonly content: CustomAppData;
}

export type CustomAppData = PinContact | UnpinContact | UserLogin;

export type PinContact = {
    type: "PinContact";
    pubkey: string;
};

export type UnpinContact = {
    type: "UnpinContact";
    pubkey: string;
};

export type UserLogin = {
    type: "UserLogin";
};

export class ContextualEvent implements nostr.NostrEvent {
    id: string;
    sig: string;
    pubkey: string;
    kind: nostr.NostrKind;
    created_at: number;
    tags: nostr.Tag[];
    content: string;

    constructor(
        public readonly event: nostr.NostrEvent,
        public readonly ctx: nostr.NostrAccountContext,
    ) {
        this.id = event.id;
        this.sig = event.sig;
        this.pubkey = event.pubkey;
        this.kind = event.kind;
        this.created_at = event.created_at;
        this.tags = event.tags;
        this.content = event.content;
    }

    private _decryptedContent: string | Error | undefined;
    async decryptedContent() {
        if (this._decryptedContent != undefined) {
            return this._decryptedContent;
        }
        this._decryptedContent = await (() => {
            if (this.kind == NostrKind.DIRECT_MESSAGE) {
                const isSender = this.pubkey == this.ctx.publicKey.hex;
                const pTags = getTags(this).p;
                if (pTags.length > 0) {
                    const receiverPubkey = pTags[0];
                    if (isSender) {
                        return this.ctx.decrypt(receiverPubkey, this.content);
                    }
                    if (/* is receiver */ receiverPubkey == this.ctx.publicKey.hex) {
                        return this.ctx.decrypt(this.pubkey, this.content);
                    }
                    return new Error(`neither sender nor receiver of event ${this.id}`);
                } else {
                    return new Error(`event ${this.id} has no receiver`);
                }
            }
            if (this.kind == NostrKind.CustomAppData) {
                if (/* is sender */ this.ctx.publicKey.hex == this.pubkey) {
                    return this.ctx.decrypt(this.pubkey, this.content);
                } else {
                    return new Error(`not sender of event ${this.id}`);
                }
            }
            return this.content;
        })();
        return this._decryptedContent;
    }
}
