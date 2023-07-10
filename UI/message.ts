import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { MessageThread } from "./dm.tsx";
import {
    NostrAccountContext,
    NostrEvent,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { decryptDM } from "../features/dm.ts";

export function* parseContent(content: string) {
    // URLs
    yield* match(/https?:\/\/[^\s]+/g, content, "url");

    // npubs
    yield* match(/npub[0-9a-z]{59}/g, content, "npub");

    // notes
    yield* match(/note[0-9a-z]{59}/g, content, "note");

    // tags
    yield* match(/#\[[0-9]+\]/g, content, "tag");
}

function* match(regex: RegExp, content: string, type: ItemType): Generator<ContentItem, void, unknown> {
    let match;
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec#return_value
    // If the match succeeds, the exec() method returns an array and
    // updates the lastIndex property of the regular expression object.
    while ((match = regex.exec(content)) !== null) {
        const urlStartPosition = match.index;
        if (urlStartPosition == undefined) {
            return;
        }
        const urlEndPosition = urlStartPosition + match[0].length - 1;
        yield {
            type: type,
            start: urlStartPosition,
            end: urlEndPosition,
        };
    }
}

type ItemType = "url" | "npub" | "tag" | "note";
export type ContentItem = {
    type: ItemType;
    start: number;
    end: number;
};

// Think of ChatMessage as an materialized view of NostrEvent
// export interface ChatMessage_v1 {
//     readonly event: NostrEvent;
//     readonly type: "image" | "text";
//     readonly created_at: Date;
//     readonly lamport: number | undefined;
//     readonly author: {
//         pubkey: PublicKey;
//         name?: string;
//         picture?: string;
//     };
//     content: string;
// }

export class ChatMessage_v2 {
    readonly root_event: NostrEvent;
    readonly type: "image" | "text";
    readonly created_at: Date;
    readonly lamport: number | undefined;
    readonly author: {
        pubkey: PublicKey;
        name?: string;
        picture?: string;
    };
    constructor(
        public readonly args: {
            readonly root_event: NostrEvent;
            readonly type: "image" | "text";
            readonly created_at: Date;
            readonly lamport: number | undefined;
            readonly author: {
                pubkey: PublicKey;
                name?: string;
                picture?: string;
            };
            readonly content: string;
            readonly ctx: NostrAccountContext;
        },
    ) {
        this.root_event = args.root_event;
        this.type = args.type;
        this.created_at = args.created_at;
        this.lamport = args.lamport;
        this.author = args.author;
    }

    async content(): Promise<string | Error> {
        if (this.root_event.kind == NostrKind.TEXT_NOTE) {
            return this.args.content;
        }
        return decryptDM(this.args.root_event, this.args.content, this.args.ctx);
    }
}

export function urlIsImage(url: string) {
    const trimmed = url.trim();
    const parts = trimmed.split(".");
    return ["png", "jpg", "jpeg", "gif", "webp"].includes(parts[parts.length - 1]);
}

export function* groupContinuousMessages<T>(
    seq: Iterable<T>,
    checker: (previousItem: T, currentItem: T) => boolean,
) {
    let previousItem: T | undefined;
    let group: T[] = [];
    for (const currentItem of seq) {
        if (previousItem == undefined || checker(previousItem, currentItem)) {
            group.push(currentItem);
        } else {
            yield group;
            group = [currentItem];
        }
        previousItem = currentItem;
    }
    yield group;
}

export function sortMessage(messages: MessageThread[]) {
    return messages
        .sort((m1, m2) => {
            if (m1.root.lamport && m2.root.lamport) {
                if (m1.root.lamport == m2.root.lamport) {
                    return m2.root.created_at.getTime() - m1.root.created_at.getTime();
                } else {
                    return m2.root.lamport - m1.root.lamport;
                }
            }
            return m2.root.created_at.getTime() - m1.root.created_at.getTime();
        });
}
