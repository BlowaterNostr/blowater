import { prepareEncryptedNostrEvent } from "../../0_lib/nostr-ts/event.ts";
import { PublicKey } from "../../0_lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../0_lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../../0_lib/nostr-ts/relay-pool.ts";
import { DirectMessageGetter } from "../UI/app_update.tsx";
import { NewMessageListener } from "../UI/message-panel.tsx";
import { ChatMessage, parseContent } from "../UI/message.ts";
import { compare, getTags, Parsed_Event, prepareNostrImageEvent, Tag, Tags } from "../nostr.ts";
import { decodeInvitation, gmEventType } from "./gm.ts";
import {
    chan,
    Channel,
    Multicaster,
    PutToClosedChannelError,
} from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export async function sendDMandImages(args: {
    sender: NostrAccountContext;
    receiverPublicKey: PublicKey;
    message: string;
    files: Blob[];
    lamport_timestamp: number;
    pool: ConnectionPool;
    tags: Tag[];
}) {
    const { tags, sender, receiverPublicKey, message, files, lamport_timestamp, pool } = args;
    console.log("sendDMandImages", message, files);
    const eventsToSend: NostrEvent[] = [];
    if (message.trim().length !== 0) {
        // build the nostr event
        const nostrEvent = await prepareEncryptedNostrEvent(
            sender,
            {
                encryptKey: receiverPublicKey,
                kind: NostrKind.DIRECT_MESSAGE,
                tags: [
                    ["p", receiverPublicKey.hex],
                    ["lamport", String(lamport_timestamp)],
                    ...tags,
                ],
                content: message,
            },
        );
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
            NostrKind.DIRECT_MESSAGE,
        );
        if (imgEvent instanceof Error) {
            return imgEvent;
        }
        eventsToSend.push(imgEvent);
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
        yield nostrMessage;
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
        yield nostrMessage;
    }
}

function merge<T>(...iters: AsyncIterable<T>[]) {
    let merged = chan<T>();
    async function coroutine<T>(
        source: AsyncIterable<T>,
        destination: Channel<T>,
    ) {
        for await (let ele of source) {
            if (destination.closed()) {
                return;
            }
            let err = await destination.put(ele);
            if (err instanceof PutToClosedChannelError) {
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

export class DirectedMessageController implements DirectMessageGetter, NewMessageListener {
    constructor(
        public readonly ctx: NostrAccountContext,
    ) {}

    private readonly directed_messages = new Map<string, ChatMessage>();
    private readonly new_message_chan = new Channel<ChatMessage>();
    private readonly caster = new Multicaster(this.new_message_chan);

    // get the direct messages between me and this pubkey
    public getChatMessages(pubkey: string): ChatMessage[] {
        const messages = [];
        for (const message of this.directed_messages.values()) {
            if (is_DM_between(message.event, this.ctx.publicKey.hex, pubkey)) {
                messages.push(message);
            }
        }
        messages.sort((a, b) => compare(a.event, b.event));
        return messages;
    }

    public getDirectMessageStream(pubkey: string): Channel<ChatMessage> {
        const messages = new Channel<ChatMessage>();
        (async () => {
            for await (const message of this.caster.copy()) {
                if (is_DM_between(message.event, this.ctx.publicKey.hex, pubkey)) {
                    const err = await messages.put(message);
                    if (err instanceof PutToClosedChannelError) {
                        // the channel is closed by external code, most likely the caller
                        return;
                    }
                }
            }
            // should never reach here, but doesn't matter
            // because messages does not need to be closed
            await messages.close();
        })();
        return messages;
    }

    async addEvent(
        event:
            | Parsed_Event<NostrKind.DIRECT_MESSAGE | NostrKind.Group_Message>
            | NostrEvent<NostrKind.DIRECT_MESSAGE>,
    ) {
        const kind = event.kind;
        if (kind == NostrKind.Group_Message) {
            const gmEvent = { ...event, kind };
            const type = await gmEventType(this.ctx, gmEvent);
            if (type == "gm_invitation") {
                const invitation = await decodeInvitation(this.ctx, gmEvent);
                if (invitation instanceof Error) {
                    return invitation;
                }
                const message: ChatMessage = {
                    type: "gm_invitation",
                    event: gmEvent,
                    invitation: invitation,
                    author: gmEvent.publicKey,
                    created_at: new Date(gmEvent.created_at * 1000),
                    lamport: gmEvent.parsedTags.lamport_timestamp,
                    content: gmEvent.content,
                };
                this.directed_messages.set(gmEvent.id, message);
                /* do not await */ this.new_message_chan.put(message);
            }
            // else ignore
        } else {
            let parsedTags;
            if ("parsedTags" in event) {
                parsedTags = event.parsedTags;
            } else {
                parsedTags = getTags(event);
            }
            let publicKey;
            if ("publicKey" in event) {
                publicKey = event.publicKey;
            } else {
                publicKey = PublicKey.FromHex(event.pubkey);
                if (publicKey instanceof Error) {
                    return publicKey;
                }
            }
            let dmEvent = await parseDM(
                {
                    ...event,
                    kind,
                },
                this.ctx,
                parsedTags,
                publicKey,
            );
            if ("type" in dmEvent) {
                if (dmEvent.type == "Other") {
                    return dmEvent.error;
                } else if (dmEvent.type == "NotMyMessage") {
                    return; // ignore
                }
            }
            if (dmEvent instanceof Error) {
                return dmEvent;
            }
            const isImage = dmEvent.parsedTags.image;
            let chatMessage: ChatMessage;
            if (isImage) {
                const imageBase64 = dmEvent.decryptedContent;
                chatMessage = {
                    event: dmEvent,
                    author: dmEvent.publicKey,
                    content: imageBase64,
                    type: "image",
                    created_at: new Date(dmEvent.created_at * 1000),
                    lamport: dmEvent.parsedTags.lamport_timestamp,
                };
            } else {
                chatMessage = {
                    event: dmEvent,
                    author: dmEvent.publicKey,
                    content: dmEvent.decryptedContent,
                    type: "text",
                    created_at: new Date(dmEvent.created_at * 1000),
                    lamport: dmEvent.parsedTags.lamport_timestamp,
                };
            }
            this.directed_messages.set(event.id, chatMessage);
            /* do not await */ this.new_message_chan.put(chatMessage);
        }
    }

    onChange() {
        return this.caster.copy();
    }
}

function is_DM_between(event: NostrEvent, myPubkey: string, theirPubKey: string) {
    if (event.pubkey == myPubkey) {
        return getTags(event).p[0] == theirPubKey;
    } else if (event.pubkey == theirPubKey) {
        return getTags(event).p[0] == myPubkey;
    } else {
        return false;
    }
}

async function parseDM(
    event: NostrEvent<NostrKind.DIRECT_MESSAGE>,
    ctx: NostrAccountContext,
    parsedTags: Tags,
    publicKey: PublicKey,
) {
    const theOther = whoIamTalkingTo(event, ctx.publicKey);
    if (theOther.type != true) {
        return theOther;
    }
    const decrypted = await ctx.decrypt(theOther.talkingTo, event.content);
    if (decrypted instanceof Error) {
        return decrypted;
    }
    return {
        ...event,
        kind: event.kind,
        parsedTags,
        publicKey,
        decryptedContent: decrypted,
        parsedContentItems: Array.from(parseContent(decrypted)),
    };
}

export class InvalidEvent extends Error {
    constructor(public readonly event: NostrEvent, message: string) {
        super(`invliad event, expecting kind:${event.kind}, ${message}`);
        this.name = "InvalidEvent";
    }
}

export function whoIamTalkingTo(event: NostrEvent<NostrKind.DIRECT_MESSAGE>, myPublicKey: PublicKey): {
    type: true;
    talkingTo: string;
} | {
    type: "NotMyMessage";
    error: Error;
} | {
    type: "Other";
    error: Error;
} {
    // first asuming the other user is the sender
    let whoIAmTalkingTo = event.pubkey;
    const tags = getTags(event).p;

    if (tags.length === 0) {
        return {
            type: "Other",
            error: new InvalidEvent(
                event,
                `No p tag is found - Not a valid DM - id ${event.id}, kind ${event.kind}`,
            ),
        };
    } else if (tags.length > 1) {
        return {
            type: "Other",
            error: Error(`Multiple tag p: ${event}`),
        };
    }

    // if I am the sender
    if (event.pubkey === myPublicKey.hex) {
        const theirPubKey = tags[0];
        whoIAmTalkingTo = theirPubKey;
        return {
            type: true,
            talkingTo: whoIAmTalkingTo,
        };
    } else {
        const receiverPubkey = tags[0];
        if (receiverPubkey !== myPublicKey.hex) {
            return {
                type: "NotMyMessage",
                error: Error(
                    `Not my message, receiver is ${receiverPubkey}, sender is ${event.pubkey}, my key is ${myPublicKey.bech32()}`,
                ),
            };
        } else {
            // I am the receiver
            return {
                type: true,
                talkingTo: whoIAmTalkingTo,
            };
        }
    }
}
