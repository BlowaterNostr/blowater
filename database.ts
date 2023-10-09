import {
    compare,
    DirectedMessage_Event,
    Encrypted_Event,
    getTags,
    Parsed_Event,
    Profile_Nostr_Event,
} from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseJSON, ProfileData } from "./features/profile.ts";
import { parseContent } from "./UI/message.ts";
import {
    groupBy,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    Tag,
    Tags,
    verifyEvent,
} from "./lib/nostr-ts/nostr.ts";
import { PublicKey } from "./lib/nostr-ts/key.ts";
import { NoteID } from "./lib/nostr-ts/nip19.ts";
import { DirectMessageGetter } from "./UI/app_update.tsx";
import { ProfileController } from "./UI/search.tsx";

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
    get(keys: Indices): Promise<NostrEvent | undefined> | NostrEvent | undefined;
}

export interface EventPutter {
    put(e: NostrEvent): Promise<void>;
}

export type EventsAdapter = EventsFilter & EventRemover & EventGetter & EventPutter;

type Accepted_Event = Encrypted_Event | Profile_Nostr_Event | NostrEvent;
export class Database_Contextual_View implements DirectMessageGetter, ProfileController, EventGetter {
    private readonly sourceOfChange = csp.chan<Accepted_Event | null>(buffer_size);
    private readonly caster = csp.multi<Accepted_Event | null>(this.sourceOfChange);
    public readonly directed_messages = new Map<string, DirectedMessage_Event>();
    public readonly profiles = new Map<string, Profile_Nostr_Event>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        public readonly events: Parsed_Event[],
        private readonly ctx: NostrAccountContext,
    ) {}

    get(keys: Indices): Parsed_Event | undefined {
        for (const e of this.events) {
            if (e.id == keys.id) {
                return e;
            }
        }
        return undefined;
    }

    getProfilesByText(name: string): Profile_Nostr_Event[] {
        const profileEvents: NostrEvent<NostrKind.META_DATA>[] = [];
        for (const e of this.events) {
            if (e.kind === NostrKind.META_DATA) {
                // @ts-ignore
                profileEvents.push(e);
            }
        }
        if (profileEvents.length == 0) {
            return [];
        }
        const profilesPerUser = groupBy(profileEvents, (e) => e.pubkey);

        const result = [];
        for (const events of profilesPerUser.values()) {
            events.sort((e1, e2) => e2.created_at - e1.created_at);
            const p = events[0];
            const profileEvent = parseProfileEvent(p);
            if (profileEvent instanceof Error) {
                throw profileEvent; // todo: fix later
            }
            if (
                profileEvent.profile.name &&
                profileEvent.profile.name?.toLocaleLowerCase().indexOf(name.toLowerCase()) != -1
            ) {
                result.push(profileEvent);
            }
        }
        return result;
    }

    getProfilesByPublicKey(pubkey: PublicKey): Profile_Nostr_Event | undefined {
        return this.profiles.get(pubkey.hex);
    }

    setProfile(profileEvent: Profile_Nostr_Event): void {
        const profile = this.profiles.get(profileEvent.pubkey);
        if (profile) {
            if (profileEvent.created_at > profile.created_at) {
                this.profiles.set(profileEvent.pubkey, profileEvent);
            }
        } else {
            this.profiles.set(profileEvent.pubkey, profileEvent);
        }
    }

    static async New(eventsAdapter: EventsAdapter, ctx: NostrAccountContext) {
        const t = Date.now();
        const allEvents = await eventsAdapter.filter();
        console.log("Database_Contextual_View:onload", Date.now() - t, allEvents.length);

        const initialEvents = [];
        for (const e of allEvents) {
            const pubkey = PublicKey.FromHex(e.pubkey);
            if (pubkey instanceof Error) {
                console.error("impossible state");
                await eventsAdapter.remove(e.id);
                continue;
            }
            const p: Parsed_Event = {
                ...e,
                parsedTags: getTags(e),
                publicKey: pubkey,
            };
            initialEvents.push(p);
        }

        console.log("Database_Contextual_View:parsed", Date.now() - t);

        // Construct the View
        const db = new Database_Contextual_View(
            eventsAdapter,
            initialEvents,
            ctx,
        );
        console.log("Database_Contextual_View:New time spent", Date.now() - t);
        for (const e of db.events) {
            if (e.kind == NostrKind.META_DATA) {
                // @ts-ignore
                const pEvent = parseProfileEvent(e);
                if (pEvent instanceof Error) {
                    return pEvent;
                }
                db.setProfile(pEvent);
            }
        }

        // load decrypted DMs
        (async () => {
            for (const event of allEvents) {
                if (event.kind != NostrKind.DIRECT_MESSAGE) {
                    continue;
                }
                const dmEvent = await parseDM(
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
                db.sourceOfChange.put(null); // to render once
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
        const pubkey = PublicKey.FromHex(event.pubkey);
        if (pubkey instanceof Error) {
            console.error("impossible state");
            return pubkey;
        }
        const parsedEvent: Parsed_Event = {
            ...event,
            parsedTags: getTags(event),
            publicKey: pubkey,
        };

        // add event to database and notify subscribers
        console.log("Database.addEvent", NoteID.FromHex(event.id).bech32());

        this.events.push(parsedEvent);

        if (parsedEvent.kind == NostrKind.DIRECT_MESSAGE) {
            // @ts-ignore
            const dmEvent = await parseDM(parsedEvent, this.ctx, parsedEvent.parsedTags, parsedEvent.pubkey);
            if (dmEvent instanceof Error) {
                return dmEvent;
            }
            this.directed_messages.set(parsedEvent.id, dmEvent);
        } else if (parsedEvent.kind == NostrKind.META_DATA) {
            // @ts-ignore
            const pEvent = parseProfileEvent(parsedEvent);
            if (pEvent instanceof Error) {
                return pEvent;
            }
            this.setProfile(pEvent);
        }

        await this.eventsAdapter.put(event);
        /* not await */ this.sourceOfChange.put(parsedEvent);
        return parsedEvent;
    }

    //////////////////
    // On DB Change //
    //////////////////
    subscribe() {
        const c = this.caster.copy();
        const res = csp.chan<Accepted_Event | null>(buffer_size);
        (async () => {
            for await (const newE of c) {
                const err = await res.put(newE);
                if (err instanceof csp.PutToClosedChannelError) {
                    await c.close(
                        "onChange listern has been closed, closing the source",
                    );
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
            return Error(`Multiple tag p: ${event}`);
        }
    }
    // I am the receiver
    return whoIAmTalkingTo;
}

export function parseProfileEvent(
    event: NostrEvent<NostrKind.META_DATA>,
): Profile_Nostr_Event | Error {
    const parsedTags = getTags(event);
    const publicKey = PublicKey.FromHex(event.pubkey);
    if (publicKey instanceof Error) return publicKey;

    const profileData = parseJSON<ProfileData>(event.content);
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

export async function parseDM(
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
