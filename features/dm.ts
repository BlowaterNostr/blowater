import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database_Contextual_View, NotFound, whoIamTalkingTo } from "../database.ts";
import {
    DecryptionFailure,
    decryptNostrEvent,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    RelayResponse_Event,
} from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { prepareNostrImageEvent, Tag } from "../nostr.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";

export async function sendDMandImages(args: {
    sender: NostrAccountContext;
    receiverPublicKey: PublicKey;
    message: string;
    files: Blob[];
    kind: NostrKind;
    lamport_timestamp: number;
    pool: ConnectionPool;
    tags: Tag[];
}) {
    const { tags, sender, receiverPublicKey, message, files, kind, lamport_timestamp, pool } = args;
    console.log("sendDMandImages", message, files);
    const eventsToSend: NostrEvent[] = [];
    if (message.trim().length !== 0) {
        // build the nostr event
        const nostrEvent = await prepareEncryptedNostrEvent(
            sender,
            receiverPublicKey,
            kind,
            [
                ["p", receiverPublicKey.hex],
                ["lamport", String(lamport_timestamp)],
                ...tags,
            ],
            message,
        );
        console.log("sendDMandImages:", nostrEvent);
        if (nostrEvent instanceof Error) {
            return nostrEvent;
        }
        eventsToSend.push(nostrEvent);
    }
    for (let blob of files) {
        const imgEvent = await prepareNostrImageEvent(
            sender,
            receiverPublicKey,
            blob,
            kind,
            tags,
        );
        if (imgEvent instanceof Error) {
            return imgEvent;
        }
        let [fileEvent, _] = imgEvent;
        // for (const event of fileEvents) {
        eventsToSend.push(fileEvent);
        // }
    }
    // send the event
    for (const event of eventsToSend) {
        const err = await pool.sendEvent(event);
        if (err instanceof Error) {
            return err;
        }
    }
    return eventsToSend;
}

export async function sendSocialPost(args: {
    sender: NostrAccountContext;
    message: string;
    lamport_timestamp: number;
    pool: ConnectionPool;
    tags: Tag[];
}) {
    const { sender, message, lamport_timestamp, pool, tags } = args;
    console.log("sendSocialPost", message);
    const event = await prepareNormalNostrEvent(sender, NostrKind.TEXT_NOTE, [
        ["lamport", String(lamport_timestamp)],
        ...tags,
    ], message);
    const err = await pool.sendEvent(event);
    if (err instanceof Error) {
        return err;
    }
    return event;
}

export function getAllEncryptedMessagesOf(
    publicKey: PublicKey,
    relay: ConnectionPool,
) {
    const stream1 = getAllEncryptedMessagesSendBy(
        publicKey,
        relay,
    );
    const stream2 = getAllEncryptedMessagesReceivedBy(
        publicKey,
        relay,
    );
    return merge(stream1, stream2);
}

async function* getAllEncryptedMessagesSendBy(
    publicKey: PublicKey,
    relay: ConnectionPool,
) {
    let resp = await relay.newSub(
        `getAllEncryptedMessagesSendBy`,
        {
            authors: [publicKey.hex],
            kinds: [4],
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp.chan) {
        if(nostrMessage.res.type == "EVENT") {
            yield nostrMessage
        }
    }
}

async function* getAllEncryptedMessagesReceivedBy(
    publicKey: PublicKey,
    relay: ConnectionPool,
) {
    let resp = await relay.newSub(
        `getAllEncryptedMessagesReceivedBy`,
        {
            kinds: [4],
            "#p": [publicKey.hex],
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp.chan) {
        yield nostrMessage
    }
}

async function decryptMessage(
    relayResponse: RelayResponse_Event,
    ctx: NostrAccountContext,
    publicKey: string,
): Promise<NostrEvent | DecryptionFailure> {
    return decryptNostrEvent(relayResponse.event, ctx, publicKey);
}

function merge<T>(...iters: AsyncIterable<T>[]) {
    let merged = csp.chan<T>();
    async function coroutine<T>(
        source: AsyncIterable<T>,
        destination: csp.Channel<T>,
    ) {
        for await (let ele of source) {
            if (destination.closed()) {
                return;
            }
            let err = await destination.put(ele);
            if (err instanceof csp.PutToClosedChannelError) {
                // this means the merged channel was not closed when
                // line 319 is called,
                // but during waiting time of line 319, no consumer pops it and it was closed.
                // This is normal semantics of channels
                // so that it's fine to not throw it up to the call stack
                // but then this ele has already been popped from the iter,
                // it will be lost.
                throw new Error("destination channel should not be closed");
            }
        }
    }
    for (let iter of iters) {
        coroutine(iter, merged);
    }
    return merged;
}

//////////////////
// Read from DB //
//////////////////

// get the messages send by and received by pubkey
export function getDirectMessageEventsOf(db: Database_Contextual_View, pubkey: PublicKey) {
    return db.filterEvents(filterDMof(pubkey));
}

export function getContactPubkeysOf(db: Database_Contextual_View, pubkey: PublicKey): Set<string> | Error {
    const msgs = getDirectMessageEventsOf(db, pubkey);
    const contactList = new Set<string>();
    for (const event of msgs) {
        const whoIAmTalkingTo = whoIamTalkingTo(event, pubkey);
        if (whoIAmTalkingTo instanceof Error) {
            return whoIAmTalkingTo;
        }
        contactList.add(whoIAmTalkingTo);
    }
    return contactList;
}

export function getNewestEventOf(
    db: Database_Contextual_View,
    pubkey: PublicKey,
): NostrEvent | typeof NotFound {
    const events = Array.from(getDirectMessageEventsOf(db, pubkey));
    if (events.length === 0) {
        return NotFound;
    }
    let newest = events[0];
    for (let event of events.slice(1)) {
        if (event.created_at > newest.created_at) {
            newest = event;
        }
    }
    return newest;
}

export function get_Kind4_Events_Between(
    db: Database_Contextual_View,
    myPubKey: string,
    contactPubkey: string,
) {
    const events = db.filterEvents(
        filterDMBetween(myPubKey, contactPubkey),
    );
    return events;
}

function filterDMof(pubkey: PublicKey) {
    return (e: NostrEvent) => {
        const isAuthor = e.pubkey === pubkey.hex;
        const isReceiver = e.tags.filter((t) => t[0] === "p" && t[1] === pubkey.hex).length === 1;
        const isDM = e.kind === NostrKind.DIRECT_MESSAGE;
        return isDM && (isAuthor || isReceiver);
    };
}

function filterDMBetween(myPubKey: string, contactPubKey: string) {
    return (e: NostrEvent) => {
        const isDM = e.kind === NostrKind.DIRECT_MESSAGE;
        const iAmAuthor = e.pubkey === myPubKey;
        const otherIsReceiver = e.tags.filter((t) => t[0] === "p" && t[1] === contactPubKey)
            .length > 0;
        const otherIsAuthor = e.pubkey === contactPubKey;
        const iAmReceiver = e.tags.filter((t) => t[0] === "p" && t[1] === myPubKey).length > 0;
        return isDM &&
            ((iAmAuthor && otherIsReceiver) || (otherIsAuthor && iAmReceiver));
    };
}
