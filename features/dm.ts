import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database_Contextual_View, NotFound, whoIamTalkingTo } from "../database.ts";
import {
    DecryptionFailure,
    decryptNostrEvent,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    prepareEncryptedNostrEvent,
    prepareNormalNostrEvent,
    RelayResponse_Event,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { prepareNostrImageEvents, Tag } from "../nostr.ts";
import {
    PrivateKey,
    PublicKey,
    publicKeyHexFromNpub,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

export async function sendDMandImages(args: {
    sender: NostrAccountContext;
    receiverPublicKey: PublicKey;
    message: string;
    files: Blob[];
    kind: NostrKind;
    lamport_timestamp: number;
    pool: ConnectionPool;
    waitAll: boolean;
    tags: Tag[];
}) {
    const { tags, sender, receiverPublicKey, message, files, kind, lamport_timestamp, pool, waitAll } = args;
    console.log("sendDMandImages", message, files);
    const eventsToSend: NostrEvent[] = [];
    if (message.trim().length !== 0) {
        // build the nostr event
        const nostrEvent = await prepareEncryptedNostrEvent(
            sender,
            receiverPublicKey.hex,
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
        const imgEvent = await prepareNostrImageEvents(
            sender,
            receiverPublicKey,
            blob,
            kind,
            tags,
        );
        if (imgEvent instanceof Error) {
            return imgEvent;
        }
        let [fileEvents, _] = imgEvent;
        for (const event of fileEvents) {
            eventsToSend.push(event);
        }
    }
    // send the event
    const ps = [];
    for (const event of eventsToSend) {
        ps.push(pool.sendEvent(event));
    }
    return waitAll ? Promise.all(ps) : Promise.race(ps);
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
    return pool.sendEvent(event);
}

export function getAllEncryptedMessagesOf(
    publicKey: PublicKey,
    relay: ConnectionPool,
    since?: number,
    limit?: number,
) {
    const stream1 = getAllEncryptedMessagesSendBy(
        publicKey,
        relay,
        limit,
        since,
    );
    const stream2 = getAllEncryptedMessagesReceivedBy(
        publicKey,
        relay,
        limit,
        since,
    );
    return merge(stream1, stream2);
}

export async function* getAllDecryptedMessagesOf(
    ctx: NostrAccountContext,
    pool: ConnectionPool,
    limit: number,
) {
    const pub = ctx.publicKey;
    const allEncryptedMessage = getAllEncryptedMessagesOf(pub, pool, 0, limit);
    for await (const { res: message } of allEncryptedMessage) {
        if (message.type === "EVENT") {
            yield decryptMessage(message, ctx, message.event.pubkey);
        } else if (message.type === "EOSE" && limit > 0) {
            await allEncryptedMessage.close(`getAllDecryptedMessagesOf, EOSE`);
            return; // if limit is provided, stop the stream
        }
    }
}

async function* getAllEncryptedMessagesSendBy(
    publicKey: PublicKey,
    relay: ConnectionPool,
    limit?: number,
    since?: number,
) {
    let resp = await relay.newSub(
        `getAllEncryptedMessagesSendBy ${publicKey.hex}`,
        {
            authors: [publicKey.hex],
            kinds: [4],
            limit: limit,
            since: since,
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp) {
        yield nostrMessage;
    }
}

async function* getAllEncryptedMessagesReceivedBy(
    publicKey: PublicKey,
    relay: ConnectionPool,
    limit?: number,
    since?: number,
) {
    let resp = await relay.newSub(
        `getAllEncryptedMessagesReceivedBy ${publicKey.hex}`,
        {
            kinds: [4],
            "#p": [publicKey.hex],
            limit: limit,
            since: since,
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp) {
        yield nostrMessage;
    }
}

async function* getEncryptedMessagesBetween(
    senderPubKey: PublicKey,
    receiverPubKey: PublicKey,
    relay: ConnectionPool,
    limit: number,
) {
    let resp = await relay.newSub(
        `getEncryptedMessagesBetween ${senderPubKey.hex} ${receiverPubKey.hex}`,
        {
            authors: [senderPubKey.hex],
            kinds: [4],
            "#p": [receiverPubKey.hex],
            limit: limit,
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp) {
        yield nostrMessage;
    }
}

async function* messagesSendByMeTo(
    myPriKey: PrivateKey,
    receiverPubKey: PublicKey,
    relay: ConnectionPool,
    limit: number,
) {
    for await (
        let { res: relayResponse } of getEncryptedMessagesBetween(
            myPriKey.toPublicKey(),
            receiverPubKey,
            relay,
            limit,
        )
    ) {
        yield relayResponse;
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
