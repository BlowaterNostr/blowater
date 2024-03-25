import { getTags, Parsed_Event, Profile_Nostr_Event } from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseJSON, ProfileData } from "./features/profile.ts";
import { NostrEvent, NostrKind, Tag, verifyEvent } from "../libs/nostr.ts/nostr.ts";
import { PublicKey } from "../libs/nostr.ts/key.ts";
import { ProfileGetter, ProfileSetter } from "./UI/search.tsx";
import { NoteID } from "../libs/nostr.ts/nip19.ts";

import { BloomFilter } from "https://esm.sh/bloomfilter@0.0.18";

const buffer_size = 2000;
export interface Indices {
    readonly id: string;
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

export type RelayRecorder = {
    setRelayRecord: (eventID: string, url: string) => Promise<boolean>;
} & RelayRecordGetter;

export interface RelayRecordGetter {
    getRelayRecord: (eventID: string) => Set<string>;
}

export type EventMark = {
    event_id: string;
    reason: "removed";
};

export interface EventMarker {
    getMark(eventID: string): Promise<EventMark | undefined>;
    markEvent(eventID: string, reason: "removed"): Promise<void>;
    getAllMarks(): Promise<EventMark[]>;
}

export type EventsAdapter =
    & EventsFilter
    & EventGetter
    & EventPutter;

export class Database_View implements ProfileSetter, ProfileGetter, EventRemover, RelayRecordGetter {
    private readonly sourceOfChange = csp.chan<{ event: Parsed_Event; relay?: string }>(buffer_size);
    private readonly caster = csp.multi<{ event: Parsed_Event; relay?: string }>(this.sourceOfChange);
    private readonly profiles = new Map<string, Profile_Nostr_Event>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        private readonly relayRecorder: RelayRecorder,
        private readonly eventMarker: EventMarker,
        private readonly events: Map<string, Parsed_Event>,
        private readonly removedEvents: Set<string>,
    ) {}

    static async New(
        eventsAdapter: EventsAdapter,
        relayAdapter: RelayRecorder,
        eventMarker: EventMarker,
    ) {
        const t = Date.now();
        const allEvents = await eventsAdapter.filter();
        console.log("Database_View:onload", Date.now() - t, allEvents.length);

        const initialEvents = new Map<string, Parsed_Event>();
        for (const e of allEvents) {
            const pubkey = PublicKey.FromHex(e.pubkey);
            if (pubkey instanceof Error) {
                console.error("impossible state");
                await eventMarker.markEvent(e.id, "removed");
                continue;
            }
            const p: Parsed_Event = {
                ...e,
                parsedTags: getTags(e),
                publicKey: pubkey,
            };
            initialEvents.set(p.id, p);
        }

        console.log("Database_View:parsed", Date.now() - t);

        const all_removed_events = await eventMarker.getAllMarks();

        // Construct the View
        const db = new Database_View(
            eventsAdapter,
            relayAdapter,
            eventMarker,
            initialEvents,
            new Set(all_removed_events.map((mark) => mark.event_id)),
        );
        console.log("Database_View:New time spent", Date.now() - t);
        for (const e of db.events.values()) {
            if (e.kind == NostrKind.META_DATA) {
                // @ts-ignore
                const pEvent = parseProfileEvent(e);
                if (pEvent instanceof Error) {
                    console.error(pEvent);
                    continue;
                }
                db.setProfile(pEvent);
            }
        }

        return db;
    }

    getEventByID = (id: string | NoteID) => {
        if (id instanceof NoteID) {
            id = id.hex;
        }
        if (this.removedEvents.has(id)) {
            return;
        }
        return this.events.get(id);
    };

    *getAllEvents() {
        for (const event of this.events.values()) {
            if (this.removedEvents.has(event.id)) {
                continue;
            }
            yield event;
        }
    }

    async remove(id: string): Promise<void> {
        this.removedEvents.add(id);
        await this.eventMarker.markEvent(id, "removed");
    }

    getProfilesByText(name: string): Profile_Nostr_Event[] {
        const result = [];
        for (const event of this.profiles.values()) {
            if (
                (event.profile.name &&
                    event.profile.name?.toLocaleLowerCase().indexOf(name.toLowerCase()) != -1) ||
                (event.profile.display_name &&
                    event.profile.display_name?.toLocaleLowerCase().indexOf(name.toLocaleLowerCase()) != -1)
            ) {
                result.push(event);
            }
        }
        return result;
    }

    getProfilesByPublicKey(pubkey: PublicKey): Profile_Nostr_Event | undefined {
        const profile = this.profiles.get(pubkey.hex);
        return profile;
    }

    getUniqueProfileCount(): number {
        return this.profiles.size;
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

    // If url is undefined, it's a locally created event that's not confirmed by relays yet.
    async addEvent(event: NostrEvent, url?: string | undefined) {
        const ok = await verifyEvent(event);
        if (!ok) {
            return ok;
        }

        const mark = await this.eventMarker.getMark(event.id);
        if (mark != undefined && mark.reason == "removed") {
            return false;
        }

        let new_relay_record = false;
        if (url) {
            new_relay_record = await this.recordRelay(event.id, url);
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

        // check if the event exists
        {
            const storedEvent = this.getEventByID(event.id);
            if (storedEvent) { // event exist
                if (new_relay_record) {
                    this.sourceOfChange.put({ event: parsedEvent, relay: url });
                }
                return false;
            }
        }

        // add event to database and notify subscribers
        console.log("Database.addEvent", event);

        this.events.set(parsedEvent.id, parsedEvent);

        if (parsedEvent.kind == NostrKind.META_DATA) {
            const pEvent = parseProfileEvent(parsedEvent as NostrEvent<NostrKind.META_DATA>);
            if (pEvent instanceof Error) {
                return pEvent;
            }
            this.setProfile(pEvent);
        }

        await this.eventsAdapter.put(event);
        /* not await */ this.sourceOfChange.put({ event: parsedEvent, relay: url });
        return parsedEvent;
    }

    //////////////////
    // On DB Change //
    //////////////////
    subscribe() {
        const c = this.caster.copy();
        const res = csp.chan<{ event: Parsed_Event; relay?: string }>(buffer_size);
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

    getRelayRecord(eventID: string) {
        return this.relayRecorder.getRelayRecord(eventID);
    }

    private async recordRelay(eventID: string, url: string) {
        const records = this.relayRecorder.getRelayRecord(eventID);
        if (records.has(url)) {
            return false;
        }
        await this.relayRecorder.setRelayRecord(eventID, url);
        return true;
    }
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

const hash_func = 16;
const byte_size = 8 * 1024 * 16;
export class RelayRecorderBloomFilter implements RelayRecorder {
    static FromLocalStorage() {
        const str = localStorage.getItem(RelayRecorderBloomFilter.name);
        let filters: { [key: string]: BloomFilter } = {};
        if (str) {
            const filters_encoded = JSON.parse(str);
            for (let key in filters_encoded) {
                filters[key] = new BloomFilter(hexStringToInt32Array(filters_encoded[key]), hash_func);
            }
        }
        return new RelayRecorderBloomFilter(filters);
    }

    private constructor(
        private filters: { [key: string]: BloomFilter },
    ) {}

    setRelayRecord = async (eventID: string, url: string): Promise<boolean> => {
        const t = Date.now();
        let filter = this.filters[url];
        if (filter == undefined) {
            filter = new BloomFilter(byte_size, hash_func);
            this.filters[url] = filter;
        }

        filter.add(eventID);
        const filter_encoded: { [key: string]: string } = {};
        for (let key in this.filters) {
            filter_encoded[key] = int32ArrayToHexString(this.filters[key]?.buckets);
        }
        localStorage.setItem(RelayRecorderBloomFilter.name, JSON.stringify(filter_encoded));
        console.log("setRelayRecord", Date.now() - t);
        return true;
    };

    getRelayRecord(eventID: string): Set<string> {
        const set = new Set<string>();
        for (let relay in this.filters) {
            const yes = this.filters[relay].test(eventID);
            if (yes) {
                set.add(relay);
            }
        }
        return set;
    }
}

function int32ArrayToHexString(arr: Int32Array) {
    return Array.from(arr).map(function (i) {
        // Convert each integer to a hex string, pad with zeros to ensure 8 characters
        return ("00000000" + (i >>> 0).toString(16)).slice(-8);
    }).join("");
}

function hexStringToInt32Array(hexStr: string) {
    // Ensure the hex string's length is a multiple of 8
    if (hexStr.length % 8 !== 0) {
        throw new Error("Invalid hex string length.");
    }

    const numInts = hexStr.length / 8;
    const arr = new Int32Array(numInts);

    for (let i = 0; i < numInts; i++) {
        // Extract 8-character chunk, convert to a 32-bit integer, and store in the array
        const hexChunk = hexStr.substring(i * 8, i * 8 + 8);
        arr[i] = parseInt(hexChunk, 16) | 0; // Using | 0 to ensure it's treated as a signed 32-bit integer
    }

    return arr;
}
