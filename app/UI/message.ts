import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { DirectedMessage_Event, Parsed_Event } from "../nostr.ts";
import { NostrKind } from "../../libs/nostr.ts/nostr.ts";

const regexs: { name: ItemType; regex: RegExp }[] = [
    { name: "url", regex: /https?:\/\/[^\s]+/ },
    { name: "npub", regex: /(nostr:)?npub[0-9a-z]{59}/ },
    { name: "nprofile", regex: /(nostr:)?nprofile[0-9a-z]+/ },
    { name: "naddr", regex: /(nostr:)?naddr[0-9a-z]+/ },
    { name: "note", regex: /note[0-9a-z]{59}/ },
    { name: "nevent", regex: /(nostr:)?nevent[0-9a-z]+/ },
    { name: "tag", regex: /#\[[0-9]+\]/ },
];

export function parseContent(content: string): { text: string; type: ItemType | "normal" }[] {
    if (content.length === 0) {
        return [];
    }
    let max_length_match: {
        name: ItemType;
        start: number;
        end: number;
    } | undefined;
    for (const r of regexs) {
        const mached = r.regex.exec(content);
        if (mached !== null) {
            const start = mached.index;
            const end = mached.index + mached[0].length;
            // Return the matching string with the maximum length
            if (!max_length_match || (end - start) > (max_length_match.end - max_length_match.start)) {
                max_length_match = { name: r.name, start, end };
            }
        }
    }
    if (!max_length_match) {
        return [
            {
                text: content,
                type: "normal",
            },
        ];
    }
    return [
        ...parseContent(content.substring(0, max_length_match.start)),
        {
            text: content.substring(max_length_match.start, max_length_match.end),
            type: max_length_match.name,
        },
        ...parseContent(content.substring(max_length_match.end, content.length)),
    ];
}

type otherItemType = "url" | "tag";
export type ItemType = otherItemType | "note" | "npub" | "nprofile" | "naddr" | "nevent";

// Think of ChatMessage as an materialized view of NostrEvent
export type ChatMessage = {
    readonly type: "image" | "text";
    readonly event: DirectedMessage_Event | Parsed_Event<NostrKind.TEXT_NOTE | NostrKind.Long_Form>;
    readonly author: PublicKey;
    readonly created_at: Date;
    readonly lamport: number | undefined;
    readonly content: string;
};

export function urlIsImage(url: string) {
    const trimmed = url.trim().toLocaleLowerCase();
    const parts = trimmed.split(".");
    return ["png", "jpg", "jpeg", "gif", "webp"].includes(parts[parts.length - 1]);
}

export function urlIsVideo(url: string) {
    const trimmed = url.trim().toLocaleLowerCase();
    const parts = trimmed.split(".");
    return ["mov", "mp4", "wmv", "flv", "avi", "webm", "mkv"].includes(parts[parts.length - 1]);
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
    if (group.length > 0) {
        yield group;
    }
}

export function sortMessage(messages: ChatMessage[]) {
    return messages
        .sort((m1, m2) => {
            if (m1.lamport && m2.lamport) {
                if (m1.lamport == m2.lamport) {
                    return m1.created_at.getTime() - m2.created_at.getTime();
                } else {
                    return m1.lamport - m2.lamport;
                }
            }
            return m1.created_at.getTime() - m2.created_at.getTime();
        });
}

// credit to GPT4
export function findUrlInString(text: string): (string | URL)[] {
    // Regular expression for URLs with various protocols
    const urlRegex = /[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s]+/g;

    // Split the text into URL and non-URL parts
    let parts = text.split(urlRegex);

    // Find all URLs using the regex
    const foundUrls = text.match(urlRegex) || [];

    // Interleave non-URL parts and URL parts
    let result: (string | URL)[] = [];
    parts.forEach((part, index) => {
        if (part !== "") {
            result.push(part);
        }
        if (index < foundUrls.length) {
            try {
                result.push(new URL(foundUrls[index]));
            } catch {
                result.push(foundUrls[index]);
            }
        }
    });

    return result;
}
