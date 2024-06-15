import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { InvalidKey, PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { DirectMessageGetter } from "../UI/app_update.tsx";
import { ChatMessage } from "../UI/message.ts";
import {
    compare,
    DirectedMessage_Event,
    getTags,
    Parsed_Event,
    prepareNostrImageEvent,
    prepareReplyEncryptEvent,
    Tag,
    Tags,
} from "../nostr.ts";
import { EventSender } from "../../libs/nostr.ts/relay.interface.ts";

import {
    Channel,
    Multicaster,
    PutToClosedChannelError,
} from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import * as nostr from "../../libs/nostr.ts/nostr.ts";

export async function sendDirectMessages(args: {
    sender: NostrAccountContext;
    receiverPublicKey: PublicKey;
    message: string;
    files: Blob[];
    lamport_timestamp: number;
    eventSender: EventSender;
    targetEvent?: nostr.NostrEvent;
}) {
    const {
        sender,
        receiverPublicKey,
        message,
        files,
        lamport_timestamp,
        eventSender,
        targetEvent,
    } = args;
    console.log("sendDMandImages", message, files);
    const eventsToSend: NostrEvent[] = [];
    if (message.trim().length !== 0) {
        const tags: Tag[] = [
            ["p", receiverPublicKey.hex],
            ["lamport", String(lamport_timestamp)],
        ];
        // build the nostr event
        const nostrEvent = targetEvent
            ? await prepareReplyEncryptEvent(sender, {
                encryptKey: receiverPublicKey,
                kind: NostrKind.DIRECT_MESSAGE,
                targetEvent,
                tags,
                content: message,
            })
            : await prepareEncryptedNostrEvent(
                sender,
                {
                    encryptKey: receiverPublicKey,
                    kind: NostrKind.DIRECT_MESSAGE,
                    tags,
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
        const err = await eventSender.sendEvent(event);
        if (err instanceof Error) {
            return err;
        }
    }
    return eventsToSend;
}

export async function* getAllEncryptedMessagesOf(
    publicKey: PublicKey,
    pool: ConnectionPool,
    since?: number,
) {
    let resp = await pool.newSub(`getAllEncryptedMessagesOf`, {
        authors: [publicKey.hex],
        kinds: [4],
        since,
    }, {
        "#p": [publicKey.hex],
        kinds: [4],
        since,
    });
    if (resp instanceof Error) {
        throw resp;
    }
    for await (const nostrMessage of resp.chan) {
        yield nostrMessage;
    }
}

export class DirectedMessageController implements DirectMessageGetter {
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

    public getLatestMessage(): ChatMessage | undefined {
        if (this.directed_messages.size == 0) {
            return undefined;
        }
        const msgs = Array.from(this.directed_messages.values());
        return msgs.slice(1).reduce((previous: ChatMessage, current: ChatMessage) => {
            if (current.created_at > previous.created_at) {
                return current;
            }
            return previous;
        }, msgs[0]);
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

    public getMessageById(id: string) {
        return this.directed_messages.get(id);
    }

    async addEvent(
        event:
            | Parsed_Event<NostrKind.DIRECT_MESSAGE>
            | NostrEvent<NostrKind.DIRECT_MESSAGE>,
    ) {
        const kind = event.kind;

        let parsedTags;
        if ("parsedTags" in event) {
            parsedTags = event.parsedTags;
        } else {
            parsedTags = getTags(event);
        }
        let publicKey: PublicKey | InvalidKey;
        if ("publicKey" in event) {
            publicKey = event.publicKey;
        } else {
            publicKey = PublicKey.FromHex(event.pubkey);
            if (publicKey instanceof Error) {
                return publicKey;
            }
        }
        const result = await parseDM(
            {
                ...event,
                kind,
            },
            this.ctx,
            parsedTags,
            publicKey,
        );

        if (result.type == "Other") {
            return result;
        } else if (result.type == "NotMyMessage") {
            return result;
        } else if (result.type == "error") {
            return result;
        }

        const dm_event = result.event;
        const isImage = dm_event.parsedTags.image;
        let chatMessage: ChatMessage;
        if (isImage) {
            const imageBase64 = dm_event.decryptedContent;
            chatMessage = {
                event: dm_event,
                author: dm_event.publicKey,
                content: imageBase64,
                type: "image",
                created_at: new Date(dm_event.created_at * 1000),
                lamport: dm_event.parsedTags.lamport_timestamp,
            };
        } else {
            chatMessage = {
                event: dm_event,
                author: dm_event.publicKey,
                content: dm_event.decryptedContent,
                type: "text",
                created_at: new Date(dm_event.created_at * 1000),
                lamport: dm_event.parsedTags.lamport_timestamp,
            };
        }
        this.directed_messages.set(event.id, chatMessage);
        /* do not await */ this.new_message_chan.put(chatMessage);
        return {
            type: true,
        };
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
): Promise<
    {
        type: "NotMyMessage";
        error: Error;
    } | {
        type: "Other";
        error: Error;
    } | {
        type: "error";
        error: Error;
    } | {
        type: "event";
        event: DirectedMessage_Event;
    }
> {
    const theOther = whoIamTalkingTo(event, ctx.publicKey);
    if (theOther.type != true) {
        return theOther;
    }
    const decrypted = await ctx.decrypt(theOther.talkingTo, event.content);
    if (decrypted instanceof Error) {
        return {
            type: "error",
            error: decrypted,
        };
    }
    return {
        type: "event",
        event: {
            ...event,
            kind: event.kind,
            parsedTags,
            publicKey,
            decryptedContent: decrypted,
        },
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
