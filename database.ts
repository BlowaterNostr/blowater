import {
    CustomAppData,
    CustomAppData_Event,
    DirectedMessage_Event,
    Encrypted_Event,
    Encrypted_Kind,
    getTags,
    Profile_Nostr_Event,
    Tag,
    Text_Note_Event,
} from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseProfileData } from "./features/profile.ts";
import { parseContent } from "./UI/message.ts";
import {
    DecryptionFailure,
    decryptNostrEvent,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    RelayResponse_REQ_Message,
    Tags,
    verifyEvent,
} from "./lib/nostr-ts/nostr.ts";
import { PublicKey } from "./lib/nostr-ts/key.ts";

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
    filter(f: (e: NostrEvent) => boolean): Promise<NostrEvent[]>;
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
export class Database_Contextual_View {
    private readonly sourceOfChange = csp.chan<Accepted_Event>(buffer_size);
    private readonly caster = csp.multi<Accepted_Event>(this.sourceOfChange);

    static async New(eventsAdapter: EventsAdapter, ctx: NostrAccountContext) {
        const t = Date.now();
        const allEvents = await eventsAdapter.filter((_) => true);
        const initialEvents = await loadInitialData(allEvents, ctx);
        if (initialEvents instanceof Error) {
            return initialEvents;
        }
        console.log("Database_Contextual_View:onload", Date.now() - t);
        const db = new Database_Contextual_View(
            eventsAdapter,
            initialEvents,
            ctx,
        );

        // async loading of encrypted events
        (async () => {
            try {
                let tt = 0;
                for (const event of allEvents) {
                    const pubkey = PublicKey.FromHex(event.pubkey)
                    if(pubkey instanceof Error) {
                        console.error(pubkey)
                        continue
                    }
                    const parsedEvent = await originalEventToEncryptedEvent(event, ctx, getTags(event), pubkey, eventsAdapter);
                    if (parsedEvent instanceof Error) {
                        console.error(parsedEvent);
                        await eventsAdapter.remove(event.id)
                        continue;
                    }
                    if (parsedEvent == false) {
                        continue;
                    }

                    // add event to database and notify subscribers
                    console.log("async load", parsedEvent)
                    db.events.push(parsedEvent);
                    await eventsAdapter.put(event);
                    /* not await */ db.sourceOfChange.put(parsedEvent);
                }
                console.log("Database_Contextual_View:transformEvent", tt);
            } catch (e) {
                console.error(e)
            }
        })();

        console.log("Database_Contextual_View:New time spent", Date.now() - t);
        return db;
    }

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        public readonly events: (Text_Note_Event | Encrypted_Event | Profile_Nostr_Event)[],
        private readonly ctx: NostrAccountContext,
    ) {}

    public readonly getEvent = async (keys: Indices): Promise<NostrEvent | undefined> => {
        const e = await this.eventsAdapter.get(keys);
        return e;
    };

    public readonly filterEvents = (filter: (e: NostrEvent) => boolean) => {
        return this.events.filter(filter);
    };

    async addEvent(event: NostrEvent) {
        // check if the event exists
        const storedEvent = await this.getEvent({ id: event.id });
        if (storedEvent) { // event exist
            return false;
        }

        const ok = await verifyEvent(event);
        if (!ok) {
            return ok;
        }

        // parse the event to desired format
        const parsedEvent = await originalEventToParsedEvent(event, this.ctx, this.eventsAdapter);
        if (parsedEvent instanceof Error) {
            return parsedEvent;
        }
        if (parsedEvent == false) {
            return parsedEvent;
        }

        // add event to database and notify subscribers
        console.log("Database.addEvent", event.id);
        this.events.push(parsedEvent);
        await this.eventsAdapter.put(event);
        /* not await */ this.sourceOfChange.put(parsedEvent);
        return parsedEvent;
    }

    syncEvents(
        filter: (e: NostrEvent) => boolean,
        events: csp.Channel<{event: NostrEvent, url: string /*relay url*/}>,
    ): csp.Channel<NostrEvent> {
        const resChan = csp.chan<NostrEvent>(buffer_size);
        (async () => {
            for await (const {event, url} of events) {
                if (resChan.closed()) {
                    await events.close(
                        "db syncEvents, resChan is closed, closing the source events",
                    );
                    return;
                }
                const e = event;
                if (filter(e)) {
                    const res = await this.addEvent(e);
                    if(res instanceof Error || res == false) {
                        console.error(res)
                    }
                } else {
                    console.log(
                        "event",
                        e,
                        "does not satisfy filterer",
                        filter,
                    );
                }
            }
            await resChan.close(
                "db syncEvents, source events is closed, closing the resChan",
            );
        })();
        return resChan;
    }

    // async syncNewDirectMessageEventsOf(
    //     accountContext: NostrAccountContext,
    //     msgs: csp.Channel<{ res: RelayResponse_REQ_Message; url: string }>,
    // ): Promise<csp.Channel<NostrEvent | DecryptionFailure>> {
    //     const resChan = csp.chan<NostrEvent | DecryptionFailure>(buffer_size);
    //     const publicKey = accountContext.publicKey;
    //     (async () => {
    //         for await (const { res: msg, url } of msgs) {
    //             if (msg.type !== "EVENT") {
    //                 continue;
    //             }
    //             const encryptedEvent = msg.event;
    //             const theirPubKey = whoIamTalkingTo(encryptedEvent, publicKey);
    //             if (theirPubKey instanceof Error) {
    //                 // this could happen if the user send an event without p tag
    //                 // because the application is subscribing all events send by the user
    //                 console.warn(theirPubKey);
    //                 continue;
    //             }

    //             const decryptedEvent = await decryptNostrEvent(
    //                 encryptedEvent,
    //                 accountContext,
    //                 theirPubKey,
    //             );
    //             if (decryptedEvent instanceof DecryptionFailure) {
    //                 resChan.put(decryptedEvent).then(async (res) => {
    //                     if (res instanceof csp.PutToClosedChannelError) {
    //                         await msgs.close(
    //                             "resChan has been closed, closing the source chan",
    //                         );
    //                     }
    //                 });
    //                 continue;
    //             }
    //             const storedEvent = await this.getEvent({
    //                 id: encryptedEvent.id,
    //             });
    //             if (storedEvent === undefined) {
    //                 try {
    //                     await this.addEvent(decryptedEvent);
    //                 } catch (e) {
    //                     console.log(e.message);
    //                 }
    //                 resChan.put(decryptedEvent).then(async (res) => {
    //                     if (res instanceof csp.PutToClosedChannelError) {
    //                         await msgs.close(
    //                             "resChan has been closed, closing the source chan",
    //                         );
    //                     }
    //                 });
    //             }
    //             // else do nothing
    //         }
    //         await resChan.close("source chan is clsoed, closing the resChan");
    //     })();
    //     return resChan;
    // }

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

export async function parseCustomAppDataEvent(
    event: NostrEvent<NostrKind.CustomAppData>,
    ctx: NostrAccountContext,
) {
    if (event.pubkey == ctx.publicKey.hex) { // if I am the author
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        let customAppData: CustomAppData;
        try {
            customAppData = JSON.parse(decrypted);
        } catch (e) {
            return e as Error;
        }
        if (customAppData) {
            const e: CustomAppData_Event = {
                content: event.content,
                created_at: event.created_at,
                id: event.id,
                kind: event.kind,
                pubkey: event.pubkey,
                sig: event.sig,
                tags: event.tags,
                parsedTags: getTags(event),
                customAppData: customAppData,
                publicKey: ctx.publicKey,
            };
            return e;
        }
    }
}

async function loadInitialData(events: NostrEvent[], ctx: NostrAccountContext) {
    const initialEvents: (Text_Note_Event | Profile_Nostr_Event)[] = [];
    for await (const event of events) {
        if (event.kind == NostrKind.META_DATA || event.kind == NostrKind.TEXT_NOTE) {
            const pubkey = PublicKey.FromHex(event.pubkey);
            if (pubkey instanceof Error) {
                return pubkey;
            }
            const parsedEvent = originalEventToUnencryptedEvent(
                {
                    ...event,
                    kind: event.kind,
                },
                getTags(event),
                pubkey,
            );
            if (parsedEvent instanceof Error) {
                return parsedEvent;
            }
            initialEvents.push(parsedEvent);
        }
    }
    return initialEvents;
}

async function originalEventToParsedEvent(
    event: NostrEvent,
    ctx: NostrAccountContext,
    eventsAdapter: EventRemover,
) {
    const publicKey = PublicKey.FromHex(event.pubkey);
    if (publicKey instanceof Error) {
        return publicKey;
    }

    const parsedTags = getTags(event);
    let e: Text_Note_Event | Encrypted_Event | Profile_Nostr_Event;
    if (event.kind == NostrKind.CustomAppData || event.kind == NostrKind.DIRECT_MESSAGE) {
        const _e = await originalEventToEncryptedEvent(
            {
                ...event,
                kind: event.kind,
            },
            ctx,
            parsedTags,
            publicKey,
            eventsAdapter,
        );
        if (_e instanceof Error || _e == false) {
            return _e;
        }
        e = _e;
    } else if (event.kind == NostrKind.META_DATA || event.kind == NostrKind.TEXT_NOTE) {
        const _e = originalEventToUnencryptedEvent(
            {
                ...event,
                kind: event.kind,
            },
            parsedTags,
            publicKey,
        );
        if (_e instanceof Error) {
            return _e;
        }
        e = _e;
    } else {
        return new Error(`currently not accepting kind ${event.kind}`);
    }
    return e;
}

function originalEventToUnencryptedEvent(
    event: NostrEvent<NostrKind.META_DATA | NostrKind.TEXT_NOTE>,
    parsedTags: Tags,
    publicKey: PublicKey,
) {
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
    }
    {
        return {
            ...event,
            kind: event.kind,
            parsedTags,
            publicKey,
            parsedContentItems: Array.from(parseContent(event.content)),
        };
    }
}

async function originalEventToEncryptedEvent(
    event: NostrEvent,
    ctx: NostrAccountContext,
    parsedTags: Tags,
    publicKey: PublicKey,
    eventsAdapter: EventRemover,
): Promise<Encrypted_Event | Error | false> {
    if (event.kind == NostrKind.CustomAppData) {
        const _e = await parseCustomAppDataEvent({
            ...event,
            kind: event.kind,
        }, ctx);
        if (_e == undefined) {
            return false;
        }
        if (_e instanceof Error) {
            console.log("Database:delete", event.id);
            eventsAdapter.remove(event.id); // todo: remove
            return _e;
        }
        return _e;
    } else if(event.kind == NostrKind.DIRECT_MESSAGE) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        return {
            ...event,
            kind: event.kind,
            parsedTags,
            publicKey,
            decryptedContent: decrypted,
            parsedContentItems: Array.from(parseContent(event.content)),
        };
    }
    return false
}
