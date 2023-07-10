import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database, NotFound } from "../database.ts";
import {
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    prepareEncryptedNostrEvent,
    prepareNormalNostrEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import {
    ConnectionPool,
    newSubID,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { getTags, prepareNostrImageEvents, Tag } from "../nostr.ts";
import {
    PrivateKey,
    publicKeyHexFromNpub,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

export async function sendDMandImages(args: {
    sender: NostrAccountContext;
    receiverPublicKey: string;
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
            receiverPublicKey,
            kind,
            [
                ["p", receiverPublicKey],
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
    publicKey: string,
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

export function messagesBetween(
    myPrivateKey: string,
    theirPublicKey: string,
    relay: ConnectionPool,
    limit: number,
) {
    let events1 = messagesSendToMeBy(
        myPrivateKey,
        theirPublicKey,
        relay,
        limit,
    );
    let events2 = messagesSendByMeTo(
        myPrivateKey,
        theirPublicKey,
        relay,
        limit,
    );
    return merge(events1, events2);
}

async function* getAllEncryptedMessagesSendBy(
    publicKey: string,
    relay: ConnectionPool,
    limit?: number,
    since?: number,
) {
    publicKey = publicKeyHexFromNpub(publicKey);
    let resp = await relay.newSub(
        newSubID(),
        {
            authors: [publicKey],
            kinds: [4],
            limit: limit,
            since: since,
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp) {
        if (nostrMessage.res.type == "EVENT") {
            yield {
                event: nostrMessage.res.event,
                url: nostrMessage.url,
            };
        }
    }
}

async function* getAllEncryptedMessagesReceivedBy(
    publicKey: string,
    relay: ConnectionPool,
    limit?: number,
    since?: number,
) {
    publicKey = publicKeyHexFromNpub(publicKey);
    const subid = newSubID();
    let resp = await relay.newSub(
        subid,
        {
            kinds: [4],
            "#p": [publicKey],
            limit: limit,
            since: since,
        },
    );
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp) {
        if (nostrMessage.res.type == "EVENT") {
            yield {
                event: nostrMessage.res.event,
                url: nostrMessage.url,
            };
        }
    }
}

async function* getEncryptedMessagesBetween(
    senderPubKey: string,
    receiverPubKey: string,
    relay: ConnectionPool,
    limit: number,
) {
    senderPubKey = publicKeyHexFromNpub(senderPubKey);
    receiverPubKey = publicKeyHexFromNpub(receiverPubKey);
    let resp = await relay.newSub(
        newSubID(),
        {
            authors: [senderPubKey],
            kinds: [4],
            "#p": [receiverPubKey],
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
    myPriKey: string,
    receiverPubKey: string,
    relay: ConnectionPool,
    limit: number,
) {
    receiverPubKey = publicKeyHexFromNpub(receiverPubKey);
    const myPri = PrivateKey.FromHex(myPriKey) as PrivateKey;
    for await (
        let { res: relayResponse } of getEncryptedMessagesBetween(
            myPri.toPublicKey().hex,
            receiverPubKey,
            relay,
            limit,
        )
    ) {
        yield relayResponse;
    }
}

async function* messagesSendToMeBy(
    myPriKey: string,
    senderPubKey: string,
    relay: ConnectionPool,
    limit: number,
) {
    senderPubKey = publicKeyHexFromNpub(senderPubKey);
    const myPri = PrivateKey.FromHex(myPriKey) as PrivateKey;
    for await (
        let { res: relayResponse } of getEncryptedMessagesBetween(
            senderPubKey,
            myPri.toPublicKey().hex,
            relay,
            limit,
        )
    ) {
        yield relayResponse;
    }
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
export function getDirectMessageEventsOf(db: Database, pubkey: string) {
    return db.filterEvents(filterDMof(pubkey));
}

export function getContactPubkeysOf(db: Database, pubkey: string): Set<string> | Error {
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

function whoIamTalkingTo(event: NostrEvent, myPublicKey: string) {
    if (event.kind !== NostrKind.DIRECT_MESSAGE) {
        console.log(event);
        return new Error(`event ${event.id} is not a DM`);
    }
    // first asuming the other user is the sender
    let whoIAmTalkingTo = event.pubkey;
    const tags = getTags(event).p;
    // if I am the sender
    if (event.pubkey === publicKeyHexFromNpub(myPublicKey)) {
        if (tags.length === 1) {
            const theirPubKey = tags[0];
            whoIAmTalkingTo = theirPubKey;
            return whoIAmTalkingTo;
        } else if (tags.length === 0) {
            console.log(event);
            return Error(
                `No p tag is found - Not a valid DM - id ${event.id}, kind ${event.kind}`,
            );
        } else {
            return Error(`Multiple tag p: ${event}`);
        }
    } else {
        if (tags.length === 1) {
            const receiverPubkey = tags[0];
            if (receiverPubkey !== myPublicKey) {
                return Error(
                    `Not my message, receiver is ${receiverPubkey}, sender is ${event.pubkey}, my key is ${myPublicKey}`,
                );
            }
        } else if (tags.length === 0) {
            return Error(
                `This is not a valid DM, id ${event.id}, kind ${event.kind}`,
            );
        } else {
            console.log(event);
            return Error(`Multiple tag p: ${event}`);
        }
    }
    // I am the receiver
    return whoIAmTalkingTo;
}

export function getNewestEventOf(db: Database, pubkey: string): NostrEvent | typeof NotFound {
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

export function get_Kind4_Events_Between(db: Database, myPubKey: string, contactPubkey: string) {
    const events = db.filterEvents(
        filterDMBetween(myPubKey, contactPubkey),
    );
    return events;
}

function filterDMof(pubkey: string) {
    return (e: NostrEvent) => {
        const isAuthor = e.pubkey === pubkey;
        const isReceiver = e.tags.filter((t) => t[0] === "p" && t[1] === pubkey).length === 1;
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

export async function decryptDM(event: NostrEvent, ctx: NostrAccountContext) {
    const isSender = event.pubkey == ctx.publicKey.hex;
    const pTags = getTags(event).p;
    if (pTags.length > 0) {
        const receiverPubkey = pTags[0];
        if (isSender) {
            return ctx.decrypt(receiverPubkey, event.content);
        }
        if (/* is receiver */ receiverPubkey == ctx.publicKey.hex) {
            return ctx.decrypt(event.pubkey, event.content);
        }
        return new Error(`neither sender nor receiver of event ${event.id}`);
    } else {
        return new Error(`event ${event.id} has no receiver`);
    }
}
