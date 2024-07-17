import * as csp from "@blowater/csp";

import { NostrEvent, NostrKind, NoteID, PublicKey, Tag, v2, verifyEvent } from "@blowater/nostr-sdk";

import { getTags, Parsed_Event, Profile_Nostr_Event } from "./nostr.ts";
import { parseJSON, ProfileData } from "./features/profile.ts";
import { ProfileGetter, ProfileSetter } from "./UI/search.tsx";

import { func_GetMemberSet } from "./UI/relay-detail.tsx";
import { func_GetRelayRecommendations } from "./UI/relay-recommend-list.tsx";
import { ValueMap, ValueSet } from "@blowater/collections";
import { newURL } from "https://jsr.io/@blowater/nostr-sdk/0.0.6-rc1/_helper.ts";

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

export interface RelayRecordSetter {
    setRelayRecord: (eventID: string, url: string) => Promise<void>;
}

export interface AllRelayRecordGetter {
    getAllRelayRecords: () => Promise<Map<string, Set<string>>>;
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

export type RelayRecorder = RelayRecordSetter & AllRelayRecordGetter;

export type EventsAdapter =
    & EventsFilter
    & EventGetter
    & EventPutter;

export interface RelayRecordGetter {
    getRelayRecord: (eventID: string) => ValueSet<URL>;
}

interface MemberListGetter {
    getMemberSet: func_GetMemberSet;
}

interface RelayRecommendationsGetter {
    getRelayRecommendations: func_GetRelayRecommendations;
}

export class Database_View
    implements
        ProfileSetter,
        ProfileGetter,
        EventRemover,
        RelayRecordGetter,
        MemberListGetter,
        RelayRecommendationsGetter {
    private readonly sourceOfChange = csp.chan<{ event: Parsed_Event; relay?: URL }>(buffer_size);
    private readonly caster = csp.multi<{ event: Parsed_Event; relay?: URL }>(this.sourceOfChange);
    private readonly profile_events = new ValueMap<
        URL,
        ValueMap<PublicKey, Profile_Nostr_Event>
    >((url) => url.toString());
    private readonly deletionEvents = new Map</* event id */ string, /* deletion event */ Parsed_Event>();
    private readonly reactionEvents = new Map<
        /* event id */ string,
        /* reaction events */ ValueSet<Parsed_Event>
    >();
    private readonly latestEvents = new Map<NostrKind, Parsed_Event>();
    private readonly events_v2 = new Map<string, /* id */ v2.Event_V2>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        private readonly relayRecorder: RelayRecorder,
        private readonly eventMarker: EventMarker,
        private readonly events: ValueSet<Parsed_Event>,
        private readonly removedEvents: Set<string>,
    ) {
        this.relay_record_loaded = new Promise(async (resolve) => {
            const all_records = await relayRecorder.getAllRelayRecords();
            for (const [event_id, relays] of all_records.entries()) {
                const set = this.relayRecords.get(event_id);
                if (set) {
                    for (const relay of relays) {
                        set.add(relay);
                    }
                } else {
                    this.relayRecords.set(event_id, relays);
                }
            }
            resolve(undefined);
        });
    }

    getRelayRecommendations: func_GetRelayRecommendations = () => {
        let set = new Set<string>();
        for (const s of this.relayRecords.values()) {
            set = set.union(s);
        }
        return set;
    };

    getMemberSet: func_GetMemberSet = (relay: URL) => {
        const members = new Set<string>();
        for (const event of this.events_v2.values()) {
            if (event.kind == v2.Kind_V2.SpaceMember) {
                const records = this.getRelayRecord(event.id);
                if (records.has(relay)) {
                    members.add(event.pubkey);
                }
            }
        }
        if (members.size === 0) {
            for (const event of this.events.values()) {
                const records = this.getRelayRecord(event.id);
                if (records.has(relay)) {
                    members.add(event.pubkey);
                }
            }
        }
        return members;
    };

    static async New(
        eventsAdapter: EventsAdapter,
        relayAdapter: RelayRecorder,
        eventMarker: EventMarker,
    ) {
        const t = Date.now();
        const allEvents = await eventsAdapter.filter();
        console.log("Datebase_View:onload", Date.now() - t, allEvents.length);

        const initialEvents = new ValueSet<Parsed_Event>((e) => e.id);
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
            initialEvents.add(p);
        }

        console.log("Datebase_View:parsed", Date.now() - t);
        const all_removed_events = await eventMarker.getAllMarks();
        // Construct the View
        const db = new Database_View(
            eventsAdapter,
            relayAdapter,
            eventMarker,
            initialEvents,
            new Set(all_removed_events.map((mark) => mark.event_id)),
        );
        console.log("Datebase_View:New time spent", Date.now() - t);
        await db.waitRelayRecordToLoad();
        for (const event of db.events.values()) {
            if (event.kind == NostrKind.META_DATA) {
                // @ts-ignore
                const pEvent = parseProfileEvent(event);
                if (pEvent instanceof Error) {
                    console.error(pEvent);
                    continue;
                }
                const records = db.getRelayRecord(pEvent.id);
                for (const spaceURL of records) {
                    db.setProfile(pEvent, spaceURL);
                }
            } else if (event.kind == NostrKind.DELETE) {
                event.parsedTags.e.forEach((event_id) => {
                    db.deletionEvents.set(event_id, event);
                });
            } else if (event.kind == NostrKind.REACTION) {
                const eventId = event.parsedTags.e[0];
                const events = db.reactionEvents.get(event.parsedTags.e[0]) ||
                    new ValueSet<Parsed_Event>((e) => e.id);
                events.add(event);
                db.reactionEvents.set(eventId, events);
            }

            // update latest event
            const preLatest = db.latestEvents.get(event.kind);
            if (preLatest === undefined || preLatest.created_at < event.created_at) {
                db.latestEvents.set(event.kind, event);
            }
        }
        console.log(`Datebase_View:Deletion events size: ${db.deletionEvents.size}`);
        console.log(`Datebase_View:Reaction events size: ${db.reactionEvents.size}`);
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

    getLatestEvent = (kind: NostrKind) => {
        return this.latestEvents.get(kind);
    };

    isDeleted(id: string, admin?: string) {
        const deletionEvent = this.deletionEvents.get(id);
        if (deletionEvent == undefined) {
            return false;
        }
        const targetEvent = this.getEventByID(id);
        if (targetEvent == undefined) {
            return false;
        }
        return deletionEvent.pubkey == targetEvent.publicKey.hex ||
            deletionEvent.pubkey == admin;
    }

    getReactionEvents = (id: string) => {
        return this.reactionEvents.get(id) || new ValueSet<Parsed_Event>((e) => e.id);
    };

    async remove(id: string): Promise<void> {
        this.removedEvents.add(id);
        await this.eventMarker.markEvent(id, "removed");
    }

    private relayRecords = new Map<string, Set<string>>();
    private relay_record_loaded: Promise<void>;

    getRelayRecord(eventID: string) {
        const set = new ValueSet<URL>((url) => url.toString());
        const relays = this.relayRecords.get(eventID) || [];
        for (const urlString of relays) {
            const url = newURL(urlString);
            if (url instanceof TypeError) {
                console.error(url);
                continue;
            }
            set.add(url);
        }
        return set;
    }

    private async recordRelay(eventID: string, url: URL) {
        // some space urls hava a pathname, example: wss://example.com/nostr/space
        const urlString = url.origin + (url.pathname === "/" ? "" : url.pathname);
        await this.relayRecorder.setRelayRecord(eventID, urlString);
        const records = this.relayRecords.get(eventID);
        if (records) {
            const size = records.size;
            records.add(urlString);
            return records.size > size;
        } else {
            this.relayRecords.set(eventID, new Set([urlString]));
            return true;
        }
    }

    getProfilesByText = (
        name: string,
        spaceURL: URL | undefined,
    ): Profile_Nostr_Event[] => {
        const result: Profile_Nostr_Event[] = [];
        if (spaceURL == undefined) {
            for (const profile_events_of_space of this.profile_events.values()) {
                for (const profile_event of profile_events_of_space.values()) {
                    if (match_name(profile_event.profile, name)) {
                        result.push(profile_event);
                    }
                }
            }
            return result;
        }
        const spaceProfiels = this.profile_events.get(spaceURL);
        if (spaceProfiels) {
            for (const event of spaceProfiels.values()) {
                if (match_name(event.profile, name)) {
                    result.push(event);
                }
            }
        }
        return result;
    };

    getProfileByPublicKey = (
        pubkey: PublicKey | string,
        spaceURL: string | URL | undefined,
    ): Profile_Nostr_Event | undefined => {
        if (typeof pubkey == "string") {
            const pub = PublicKey.FromString(pubkey);
            if (pub instanceof Error) {
                console.error(pub);
                return undefined;
            }
            pubkey = pub;
        }
        if (spaceURL == undefined) {
            let result: Profile_Nostr_Event | undefined = undefined;
            for (const profile_events_of_space of this.profile_events.values()) {
                const profile_event = profile_events_of_space.get(pubkey);
                if (profile_event == undefined) continue;
                if (result && profile_event.created_at > result.created_at) {
                    result = profile_event;
                } else {
                    result = profile_event;
                }
            }
            return result;
        }
        const space = new URL(spaceURL);
        const profile_events_of_space = this.profile_events.get(space);
        if (profile_events_of_space == undefined) {
            return undefined;
        }
        return profile_events_of_space.get(pubkey);
    };

    getUniqueProfileCount = (spaceURL: URL): number => {
        return this.profile_events.get(spaceURL)?.size || 0;
    };

    setProfile(profileEvent: Profile_Nostr_Event, spaceURL: URL) {
        const spaceProfiles = this.profile_events.get(spaceURL);
        if (spaceProfiles) {
            const profile = spaceProfiles.get(profileEvent.publicKey);
            if (profile) {
                if (profileEvent.created_at > profile.created_at) {
                    spaceProfiles.set(profileEvent.publicKey, profileEvent);
                }
            } else {
                spaceProfiles.set(profileEvent.publicKey, profileEvent);
            }
        } else {
            const profile = new ValueMap<PublicKey, Profile_Nostr_Event>((p) => p.hex);
            profile.set(profileEvent.publicKey, profileEvent);
            this.profile_events.set(spaceURL, profile);
        }
    }

    // If url is undefined, it's a locally created event that's not confirmed by relays yet.
    async addEvent(event: NostrEvent, url?: URL) {
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
            new_relay_record = await this.recordRelay(event.id, new URL(url));
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

        this.events.add(parsedEvent);

        if (parsedEvent.kind == NostrKind.META_DATA) {
            const pEvent = parseProfileEvent(parsedEvent as NostrEvent<NostrKind.META_DATA>);
            if (pEvent instanceof Error) {
                return pEvent;
            }
            if (url) this.setProfile(pEvent, url);
        } else if (parsedEvent.kind == NostrKind.DELETE) {
            parsedEvent.parsedTags.e.forEach((event_id) => {
                this.deletionEvents.set(event_id, parsedEvent);
            });
        } else if (parsedEvent.kind == NostrKind.REACTION) {
            const eventId = parsedEvent.parsedTags.e[0];
            const events = this.reactionEvents.get(eventId) || new ValueSet<Parsed_Event>((e) => e.id);
            events.add(parsedEvent);
            this.reactionEvents.set(eventId, events);
        }

        await this.eventsAdapter.put(event);
        /* not await */ this.sourceOfChange.put({ event: parsedEvent, relay: url });
        return parsedEvent;
    }

    async addEvent_v2(event: v2.Event_V2, url: URL) {
        this.events_v2.set(event.id, event);
        await this.recordRelay(event.id, url);
    }

    //////////////////
    // On DB Change //
    //////////////////
    subscribe() {
        const c = this.caster.copy();
        const res = csp.chan<{ event: Parsed_Event; relay?: URL }>(buffer_size);
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

    async waitRelayRecordToLoad(): Promise<void> {
        return this.relay_record_loaded;
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
        profile: profileData,
        parsedTags,
        publicKey,
    };
}

function match_name(profile: ProfileData, search_name: string) {
    return (profile.name &&
        profile.name?.toLocaleLowerCase().indexOf(search_name.toLowerCase()) != -1) ||
        (profile.display_name &&
            profile.display_name?.toLocaleLowerCase().indexOf(search_name.toLocaleLowerCase()) !=
                -1);
}
