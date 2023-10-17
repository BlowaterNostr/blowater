import { PublicKey } from "../lib/nostr-ts/key.ts";
import { DirectedMessage_Event, Parsed_Event } from "../nostr.ts";
import { Nevent, NostrAddress, NostrProfile, NoteID } from "../lib/nostr-ts/nip19.ts";
import { NostrKind } from "../lib/nostr-ts/nostr.ts";
import { gm_Invitation } from "../features/gm.ts";

export function* parseContent(content: string) {
    // URLs
    yield* match(/https?:\/\/[^\s]+/g, content, "url");

    // npubs
    yield* match(/(nostr:)?(invitation:)?npub[0-9a-z]{59}/g, content, "npub");

    //nprofile
    yield* match(/(nostr:)?nprofile[0-9a-z]+/g, content, "nprofile");

    //naddr
    yield* match(/(nostr:)?naddr[0-9a-z]+/g, content, "naddr");

    // notes
    yield* match(/note[0-9a-z]{59}/g, content, "note");

    // nevent
    yield* match(/(nostr:)?nevent[0-9a-z]+/g, content, "nevent");

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
        if (type == "note") {
            const noteID = NoteID.FromBech32(content.slice(urlStartPosition, urlEndPosition + 1));
            if (noteID instanceof Error) {
                // ignore
            } else {
                yield {
                    type: type,
                    noteID: noteID,
                    start: urlStartPosition,
                    end: urlEndPosition,
                };
            }
        } else if (type == "npub") {
            let bech32: string;
            if (match[0].startsWith("nostr:")) {
                bech32 = content.slice(urlStartPosition + 6, urlEndPosition + 1);
            } else {
                bech32 = content.slice(urlStartPosition, urlEndPosition + 1);
            }
            const pubkey = PublicKey.FromBech32(bech32);
            if (pubkey instanceof Error) {
                // ignore
            } else {
                yield {
                    type: type,
                    pubkey: pubkey,
                    start: urlStartPosition,
                    end: urlEndPosition,
                };
            }
        } else if (type == "nprofile") {
            let bech32: string;
            if (match[0].startsWith("nostr:")) {
                bech32 = content.slice(urlStartPosition + 6, urlEndPosition + 1);
            } else {
                bech32 = content.slice(urlStartPosition, urlEndPosition + 1);
            }
            const decoded_nProfile = NostrProfile.decode(bech32);
            if (decoded_nProfile instanceof Error) {
                // ignore
            } else {
                const pubkey = decoded_nProfile.pubkey;

                yield {
                    type: "npub",
                    pubkey: pubkey,
                    start: urlStartPosition,
                    end: urlEndPosition,
                    relays: decoded_nProfile.relays,
                };
            }
        } else if (type == "naddr") {
            let bech32: string;
            if (match[0].startsWith("nostr:")) {
                bech32 = content.slice(urlStartPosition + 6, urlEndPosition + 1);
            } else {
                bech32 = content.slice(urlStartPosition, urlEndPosition + 1);
            }
            const decoded_nAddr = NostrAddress.decode(bech32);
            if (decoded_nAddr instanceof Error) {
                // ignore
            } else {
                yield {
                    type: "naddr",
                    start: urlStartPosition,
                    end: urlEndPosition,
                    addr: decoded_nAddr,
                };
            }
        } else if (type == "nevent") {
            let bech32: string;
            if (match[0].startsWith("nostr:")) {
                bech32 = content.slice(urlStartPosition + 6, urlEndPosition + 1);
            } else {
                bech32 = content.slice(urlStartPosition, urlEndPosition + 1);
            }
            const decoded_nEvent = Nevent.decode(bech32);
            if (decoded_nEvent instanceof Error) {
                // ignore
            } else {
                yield {
                    type: "nevent",
                    start: urlStartPosition,
                    end: urlEndPosition,
                    event: decoded_nEvent,
                };
            }
        } else {
            yield {
                type: type,
                start: urlStartPosition,
                end: urlEndPosition,
            };
        }
    }
}

type otherItemType = "url" | "tag";
type ItemType = otherItemType | "note" | "npub" | "nprofile" | "naddr" | "nevent";
export type ContentItem = {
    type: otherItemType;
    start: number;
    end: number;
} | {
    type: "npub";
    pubkey: PublicKey;
    start: number;
    end: number;
    relays?: string[];
} | {
    type: "note";
    noteID: NoteID;
    start: number;
    end: number;
} | {
    type: "naddr";
    start: number;
    end: number;
    addr: NostrAddress;
} | {
    type: "nevent";
    start: number;
    end: number;
    event: Nevent;
};

// Think of ChatMessage as an materialized view of NostrEvent
export type ChatMessage = {
    readonly type: "image" | "text";
    readonly event: DirectedMessage_Event | Parsed_Event<NostrKind.Group_Message>;
    readonly author: PublicKey;
    readonly created_at: Date;
    readonly lamport: number | undefined;
    readonly content: string;
} | {
    readonly type: "gm_invitation";
    readonly event: Parsed_Event<NostrKind.Group_Message>;
    readonly invitation: gm_Invitation;
    readonly author: PublicKey;
    readonly created_at: Date;
    readonly lamport: number | undefined;
    readonly content: string;
};

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
    if (group.length > 0) {
        yield group;
    }
}

export function sortMessage(messages: ChatMessage[]) {
    return messages
        .sort((m1, m2) => {
            if (m1.lamport && m2.lamport) {
                if (m1.lamport == m2.lamport) {
                    return m2.created_at.getTime() - m1.created_at.getTime();
                } else {
                    return m2.lamport - m1.lamport;
                }
            }
            return m2.created_at.getTime() - m1.created_at.getTime();
        });
}
