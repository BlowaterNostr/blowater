import { PublicKey } from "@blowater/nostr-sdk";
import { DirectedMessage_Event, Parsed_Event } from "../nostr.ts";
import { NostrKind } from "@blowater/nostr-sdk";
import { Nevent, NostrAddress, NostrProfile, NoteID } from "@blowater/nostr-sdk";

type ItemType = "url" | "tag" | "note" | "npub" | "nprofile" | "naddr" | "nevent";
export type ContentItem = {
    type: "raw" | "url" | "tag";
    text: string;
} | {
    type: "npub";
    text: string;
    pubkey: PublicKey;
} | {
    type: "nprofile";
    text: string;
    nprofile: NostrProfile;
} | {
    type: "note";
    text: string;
    noteID: NoteID;
} | {
    type: "naddr";
    text: string;
    addr: NostrAddress;
} | {
    type: "nevent";
    text: string;
    nevent: Nevent;
};

export function* parseContent(content: string): Iterable<ContentItem> {
    if (content.length === 0) {
        return;
    }
    const first_match = match_first(content);
    if (!first_match) {
        yield { text: content, type: "raw" };
        return;
    }

    const text = content.substring(first_match.start, first_match.end);
    const bech32 = text.startsWith("nostr:") ? text.slice(6) : text;
    const raw_string_before = content.substring(0, first_match.start);

    if (first_match.name === "npub") {
        const pubkey = PublicKey.FromBech32(bech32);
        if (pubkey instanceof Error) {
            yield {
                type: "raw",
                text: content.slice(0, first_match.end),
            };
            yield* parseContent(content.slice(first_match.end));
            return;
        } else {
            if (raw_string_before) {
                yield { text: raw_string_before, type: "raw" };
            }
            yield { text, type: first_match.name, pubkey };
            yield* parseContent(content.slice(first_match.end));
            return;
        }
    } else if (first_match.name === "nprofile") {
        const decoded_nProfile = NostrProfile.decode(bech32);
        if (decoded_nProfile instanceof Error) {
            yield {
                type: "raw",
                text: content.slice(0, first_match.end),
            };
            yield* parseContent(content.slice(first_match.end));
            return;
        } else {
            if (raw_string_before) {
                yield { text: raw_string_before, type: "raw" };
            }
            yield { text, type: first_match.name, nprofile: decoded_nProfile };
            yield* parseContent(content.slice(first_match.end));
            return;
        }
    } else if (first_match.name === "note") {
        const noteID = NoteID.FromBech32(bech32);
        if (noteID instanceof Error) {
            yield {
                type: "raw",
                text: content.slice(0, first_match.end),
            };
            yield* parseContent(content.slice(first_match.end));
            return;
        } else {
            if (raw_string_before) {
                yield { text: raw_string_before, type: "raw" };
            }
            yield { text, type: first_match.name, noteID };
            yield* parseContent(content.slice(first_match.end));
            return;
        }
    } else if (first_match.name === "naddr") {
        const addr = NostrAddress.decode(bech32);
        if (addr instanceof Error) {
            yield {
                type: "raw",
                text: content.slice(0, first_match.end),
            };
            yield* parseContent(content.slice(first_match.end));
            return;
        } else {
            if (raw_string_before) {
                yield { text: raw_string_before, type: "raw" };
            }
            yield { text, type: first_match.name, addr };
            yield* parseContent(content.slice(first_match.end));
            return;
        }
    } else if (first_match.name === "nevent") {
        const nevent = Nevent.decode(bech32);
        if (nevent instanceof Error) {
            yield {
                type: "raw",
                text: content.slice(0, first_match.end),
            };
            yield* parseContent(content.slice(first_match.end));
            return;
        } else {
            if (raw_string_before) {
                yield { text: raw_string_before, type: "raw" };
            }
            yield { text, type: first_match.name, nevent };
            yield* parseContent(content.slice(first_match.end));
            return;
        }
    } else {
        if (raw_string_before) {
            yield { text: raw_string_before, type: "raw" };
        }
        yield { text, type: first_match.name };
        yield* parseContent(content.slice(first_match.end));
    }
}

function match_first(content: string) {
    if (content.length === 0) {
        return;
    }

    const regexs: { name: ItemType; regex: RegExp }[] = [
        { name: "url", regex: /https?:\/\/[^\s]+/ },
        { name: "npub", regex: /(nostr:)?npub[0-9a-z]{59}/ },
        { name: "nprofile", regex: /(nostr:)?nprofile[0-9a-z]+/ },
        { name: "naddr", regex: /(nostr:)?naddr[0-9a-z]+/ },
        { name: "note", regex: /(nostr:)?note[0-9a-z]{59}/ },
        { name: "nevent", regex: /(nostr:)?nevent[0-9a-z]+/ },
        { name: "tag", regex: /#\[[0-9]+\]/ },
    ];

    let first_match: {
        name: ItemType;
        start: number;
        end: number;
    } | undefined;
    for (const r of regexs) {
        const matched = r.regex.exec(content);
        if (matched == null) {
            continue;
        }
        const start = matched.index;
        const end = matched.index + matched[0].length;

        // Return the matching string with the maximum length
        if (first_match == undefined) {
            first_match = { name: r.name, start, end };
            continue;
        }
        if (start < first_match.start) {
            first_match = { name: r.name, start, end };
            continue;
        }
        if (first_match.start == start && end > first_match.end) {
            first_match = { name: r.name, start, end };
            continue;
        }
    }
    return first_match;
}

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
