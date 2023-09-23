import {
    compare,
    DirectedMessage_Event,
    Encrypted_Event,
    getTags,
    Parsed_Event,
    Profile_Nostr_Event,
    Tag,
    Text_Note_Event,
} from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseProfileData } from "./features/profile.ts";
import { parseContent } from "./UI/message.ts";
import { NostrAccountContext, NostrEvent, NostrKind, Tags, verifyEvent } from "./lib/nostr-ts/nostr.ts";
import { PublicKey } from "./lib/nostr-ts/key.ts";
import { NoteID } from "./lib/nostr-ts/nip19.ts";
import { DirectMessageGetter } from "./UI/app_update.tsx";

export const NotFound = Symbol("Not Found");
const buffer_size = 2000;
export interface Indices {
    readonly id?: string;
    readonly create_at?: number;
    readonly kind?: NostrKind;
    readonly tags?: Tag[];
    readonly pubkey?: string;
}

export interface EventsFilter {
    filter(f?: (e: NostrEvent) => boolean): Promise<NostrEvent[]>;
}

export interface EventRemover {
    remove(id: string): Promise<void>;
}

export interface EventGetter {
    get(keys: Indices): Promise<NostrEvent | undefined>;
}

export interface EventPutter {
    put(e: NostrEvent): Promise<void>;
}

export type EventsAdapter = EventsFilter & EventRemover & EventGetter & EventPutter;

type Accepted_Event = Text_Note_Event | Encrypted_Event | Profile_Nostr_Event;
export class Database_Contextual_View implements DirectMessageGetter {
    private readonly sourceOfChange = csp.chan<Accepted_Event>(buffer_size);
    private readonly caster = csp.multi<Accepted_Event>(this.sourceOfChange);
    public readonly directed_messages = new Map<string, DirectedMessage_Event>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        public readonly events:
            (Text_Note_Event | NostrEvent<NostrKind.DIRECT_MESSAGE> | Profile_Nostr_Event)[],
        private readonly ctx: NostrAccountContext,
    ) {}

    static async New(eventsAdapter: EventsAdapter, ctx: NostrAccountContext) {
        const t = Date.now();
        const allEvents = await eventsAdapter.filter();
        console.log("Database_Contextual_View:onload", Date.now() - t, allEvents.length);

        // Load Non Encrypted Data
        const initialEvents:
            (Text_Note_Event | NostrEvent<NostrKind.DIRECT_MESSAGE> | Profile_Nostr_Event)[] =
                await loadInitialData(allEvents, eventsAdapter);
        if (initialEvents instanceof Error) {
            return initialEvents;
        }
        console.log("Database_Contextual_View:parsed", Date.now() - t);

        // Load DMs
        for (const event of allEvents) {
            if (event.kind == NostrKind.DIRECT_MESSAGE) {
                initialEvents.push({
                    ...event,
                    kind: event.kind,
                });
            }
        }

        // Construct the View
        const db = new Database_Contextual_View(
            eventsAdapter,
            initialEvents,
            ctx,
        );
        console.log("Database_Contextual_View:New time spent", Date.now() - t);

        // load decrypted DMs
        (async () => {
            for (const event of allEvents) {
                if (event.kind != NostrKind.DIRECT_MESSAGE) {
                    continue;
                }
                const dmEvent = await originalEventToEncryptedEvent(
                    // @ts-ignore
                    event,
                    ctx,
                    getTags(event),
                    PublicKey.FromHex(event.pubkey),
                );
                if (dmEvent instanceof Error) {
                    await eventsAdapter.remove(event.id);
                    continue;
                }
                db.directed_messages.set(event.id, dmEvent);
            }
        })();
        return db;
    }

    public readonly filterEvents = (filter: (e: NostrEvent) => boolean) => {
        return this.events.filter(filter);
    };

    // get the direct messages between me and this pubkey
    public getDirectMessages(pubkey: string) {
        const events = [];
        for (const event of this.directed_messages.values()) {
            if (is_DM_between(event, this.ctx.publicKey.hex, pubkey)) {
                events.push(event);
            }
        }
        return events.sort(compare);
    }

    // public *get_all_dm_events() {
    //     for(const event of this.events) {
    //         if(event.kind == NostrKind.DIRECT_MESSAGE) {
    //             yield event
    //         }
    //     }
    // }

    async addEvent(event: NostrEvent) {
        // check if the event exists
        const storedEvent = await this.eventsAdapter.get({ id: event.id });
        if (storedEvent) { // event exist
            return false;
        }

        const ok = await verifyEvent(event);
        if (!ok) {
            return ok;
        }

        // parse the event to desired format
        const parsedEvent = await originalEventToParsedEvent(event, this.ctx);
        if (parsedEvent instanceof Error) {
            return parsedEvent;
        }
        // if (parsedEvent == false) {
        //     return parsedEvent;
        // }

        // add event to database and notify subscribers
        console.log("Database.addEvent", NoteID.FromHex(event.id).bech32());
        this.events.push(parsedEvent);
        await this.eventsAdapter.put(event);
        /* not await */ this.sourceOfChange.put(parsedEvent);
        return parsedEvent;
    }

    //////////////////
    // On DB Change //
    //////////////////
    subscribe(filter?: (e: Accepted_Event) => boolean) {
        const c = this.caster.copy();
        const res = csp.chan<Accepted_Event>(buffer_size);
        (async () => {
            for await (const newE of c) {
                if (filter == undefined || filter(newE)) {
                    const err = await res.put(newE);
                    if (err instanceof csp.PutToClosedChannelError) {
                        await c.close(
                            "onChange listern has been closed, closing the source",
                        );
                    }
                }
            }
            await res.close(
                "onChange source has been closed, closing the listener",
            );
        })();
        return res;
    }
}

export function whoIamTalkingTo(event: NostrEvent, myPublicKey: PublicKey) {
    if (event.kind !== NostrKind.DIRECT_MESSAGE) {
        console.log(event);
        return new Error(`event ${event.id} is not a DM`);
    }
    // first asuming the other user is the sender
    let whoIAmTalkingTo = event.pubkey;
    const tags = getTags(event).p;
    // if I am the sender
    if (event.pubkey === myPublicKey.hex) {
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
            if (receiverPubkey !== myPublicKey.hex) {
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

async function loadInitialData(events: NostrEvent[], eventsRemover: EventRemover) {
    const initialEvents = [];
    for await (const event of events) {
        if (event.kind != NostrKind.META_DATA && event.kind != NostrKind.TEXT_NOTE) {
            continue;
        }
        const parsedTags = getTags(event);
        const publicKey = PublicKey.FromHex(event.pubkey) as PublicKey;
        const parsedEvent = originalEventToUnencryptedEvent(
            // @ts-ignore
            event,
            parsedTags,
            publicKey,
        );

        if (parsedEvent instanceof Error) {
            console.error(parsedEvent.message);
            await eventsRemover.remove(event.id);
            continue;
        }

        initialEvents.push(parsedEvent);
    }
    return initialEvents;
}

export async function originalEventToParsedEvent(
    event: NostrEvent,
    ctx: NostrAccountContext,
) {
    const publicKey = PublicKey.FromHex(event.pubkey);
    if (publicKey instanceof Error) {
        return publicKey;
    }
    const parsedTags = getTags(event);
    if (event.kind == NostrKind.DIRECT_MESSAGE) {
        return originalEventToEncryptedEvent(
            // @ts-ignore
            event,
            ctx,
            parsedTags,
            publicKey,
        );
        // return false
    } else if (event.kind == NostrKind.META_DATA || event.kind == NostrKind.TEXT_NOTE) {
        return originalEventToUnencryptedEvent(
            // @ts-ignore
            event,
            parsedTags,
            publicKey,
        );
    } else {
        return new Error(`currently not accepting kind ${event.kind}`);
    }
}

export function originalEventToUnencryptedEvent<Kind extends NostrKind.META_DATA | NostrKind.TEXT_NOTE>(
    event: NostrEvent<Kind>,
    parsedTags: Tags,
    publicKey: PublicKey,
): Text_Note_Event | Profile_Nostr_Event | Error {
    if (event.kind == NostrKind.META_DATA) {
        const profileData = parseProfileData(event.content);
        if (profileData instanceof Error) {
            return profileData;
        }
        return {
            ...event,
            kind: event.kind,
            profile: profileData,
            parsedTags,
            publicKey,
        };
    } else {
        return {
            ...event,
            kind: event.kind,
            parsedTags,
            publicKey,
            parsedContentItems: Array.from(parseContent(event.content)),
        };
    }
}

export async function originalEventToEncryptedEvent(
    event: NostrEvent<NostrKind.DIRECT_MESSAGE>,
    ctx: NostrAccountContext,
    parsedTags: Tags,
    publicKey: PublicKey,
): Promise<Encrypted_Event | Error> {
    const theOther = whoIamTalkingTo(event, ctx.publicKey);
    if (theOther instanceof Error) {
        return theOther;
    }
    const decrypted = await ctx.decrypt(theOther, event.content);
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

function is_DM_between(event: NostrEvent, myPubkey: string, theirPubKey: string) {
    if (event.pubkey == myPubkey) {
        return getTags(event).p[0] == theirPubKey;
    } else if (event.pubkey == theirPubKey) {
        return getTags(event).p[0] == myPubkey;
    } else {
        return false;
    }
}
