import { Encrypted_Event, getTags, Parsed_Event, Profile_Nostr_Event } from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseJSON, ProfileData } from "./features/profile.ts";
import { parseContent } from "./UI/message.ts";
import { NostrAccountContext, NostrEvent, NostrKind, Tag, Tags, verifyEvent } from "./lib/nostr-ts/nostr.ts";
import { PublicKey } from "./lib/nostr-ts/key.ts";
import { ProfileController } from "./UI/search.tsx";
import { RelayRecord } from "./UI/dexie-db.ts";

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

export interface RecordRelay {
    recordRelay: (eventID: string, url: string) => Promise<void>;
}

export type EventsAdapter =
    & EventsFilter
    & EventRemover
    & EventGetter
    & EventPutter
    & RecordRelay;

export class Database_Contextual_View implements ProfileController, EventGetter, EventRemover {
    public readonly sourceOfChange = csp.chan<Parsed_Event | null>(buffer_size);
    private readonly caster = csp.multi<Parsed_Event | null>(this.sourceOfChange);
    public readonly profiles = new Map<string, Profile_Nostr_Event>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        public readonly events: Parsed_Event[],
    ) {}

    static async New(eventsAdapter: EventsAdapter) {
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

        return db;
    }

    get(keys: Indices): Parsed_Event | undefined {
        for (const e of this.events) {
            if (e.id == keys.id) {
                return e;
            }
        }
        return undefined;
    }

    remove(id: string): Promise<void> {
        return this.eventsAdapter.remove(id);
    }

    getProfilesByText(name: string): Profile_Nostr_Event[] {
        const result = [];
        for (const event of this.profiles.values()) {
            if (
                event.profile.name &&
                event.profile.name?.toLocaleLowerCase().indexOf(name.toLowerCase()) != -1
            ) {
                result.push(event);
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

    async addEvent(event: NostrEvent, url?: string) {
        const ok = await verifyEvent(event);
        if (!ok) {
            return ok;
        }

        if (url) {
            await this.eventsAdapter.recordRelay(event.id, url);
        }

        // check if the event exists
        const storedEvent = await this.eventsAdapter.get({ id: event.id });
        if (storedEvent) { // event exist
            return false;
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
        console.log("Database.addEvent", event);

        this.events.push(parsedEvent);

        if (parsedEvent.kind == NostrKind.META_DATA) {
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
        const res = csp.chan<Parsed_Event | null>(buffer_size);
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
