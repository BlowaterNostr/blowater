import { getTags, Parsed_Event, Profile_Nostr_Event } from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseJSON, ProfileData } from "./features/profile.ts";
import { Event_V2, Kind_V2, NostrEvent, NostrKind, Tag, verifyEvent } from "../libs/nostr.ts/nostr.ts";
import { PublicKey } from "../libs/nostr.ts/key.ts";
import { ProfileGetter, ProfileSetter } from "./UI/search.tsx";
import { NoteID } from "../libs/nostr.ts/nip19.ts";
import { func_GetMemberSet } from "./UI/relay-detail.tsx";
import { func_GetRelayRecommendations } from "./UI/relay-recommend-list.tsx";

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
    getRelayRecord: (eventID: string) => Set<string>;
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
    private readonly sourceOfChange = csp.chan<{ event: Parsed_Event; relay?: string }>(buffer_size);
    private readonly caster = csp.multi<{ event: Parsed_Event; relay?: string }>(this.sourceOfChange);
    private readonly profiles = new Map<string, Profile_Nostr_Event>();
    private readonly deletionEvents = new Map</* event id */ string, /* deletion event */ Parsed_Event>();
    private readonly reactionEvents = new Map<
        /* event id */ string,
        /* reaction events */ Set<Parsed_Event>
    >();
    private readonly latestEvents = new Map<NostrKind, Parsed_Event>();
    private readonly events_v2 = new Map<string, /* id */ Event_V2>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        private readonly relayRecorder: RelayRecorder,
        private readonly eventMarker: EventMarker,
        private readonly events: Map<string, Parsed_Event>,
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

    getMemberSet = (relay: URL | string) => {
        let url;
        try {
            url = (new URL(relay)).toString();
        } catch (e) {
            return e as TypeError;
        }
        const members = new Set<string>();
        for (const event of this.events_v2.values()) {
            if (event.kind == Kind_V2.SpaceMember) {
                const records = this.getRelayRecord(event.id);
                if (records.has(url)) {
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

        for (const event of db.events.values()) {
            if (event.kind == NostrKind.META_DATA) {
                // @ts-ignore
                const pEvent = parseProfileEvent(event);
                if (pEvent instanceof Error) {
                    console.error(pEvent);
                    continue;
                }
                db.setProfile(pEvent);
            } else if (event.kind == NostrKind.DELETE) {
                event.parsedTags.e.forEach((event_id) => {
                    db.deletionEvents.set(event_id, event);
                });
            } else if (event.kind == NostrKind.REACTION) {
                const eventId = event.parsedTags.e[0];
                const events = db.reactionEvents.get(event.parsedTags.e[0]) || new Set<Parsed_Event>();
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
        return this.reactionEvents.get(id) || new Set<Parsed_Event>();
    };

    async remove(id: string): Promise<void> {
        this.removedEvents.add(id);
        await this.eventMarker.markEvent(id, "removed");
    }

    private relayRecords = new Map<string, Set<string>>();
    private relay_record_loaded: Promise<void>;
    getRelayRecord(eventID: string) {
        const relays = this.relayRecords.get(eventID);
        if (relays == undefined) {
            return new Set<string>();
        }
        return relays;
    }

    private async recordRelay(eventID: string, url: string) {
        await this.relayRecorder.setRelayRecord(eventID, url);
        const records = this.relayRecords.get(eventID);
        if (records) {
            const size = records.size;
            records.add(url);
            return records.size > size;
        } else {
            this.relayRecords.set(eventID, new Set([url]));
            return true;
        }
    }

    getProfilesByText = (name: string): Profile_Nostr_Event[] => {
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
    };

    getProfileByPublicKey = (pubkey: PublicKey | string): Profile_Nostr_Event | undefined => {
        if (!this.profiles) return;
        if (pubkey instanceof PublicKey) {
            pubkey = pubkey.hex;
        }
        const profile = this.profiles.get(pubkey);
        return profile;
    };

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
        } else if (parsedEvent.kind == NostrKind.DELETE) {
            parsedEvent.parsedTags.e.forEach((event_id) => {
                this.deletionEvents.set(event_id, parsedEvent);
            });
        } else if (parsedEvent.kind == NostrKind.REACTION) {
            const eventId = parsedEvent.parsedTags.e[0];
            const events = this.reactionEvents.get(eventId) || new Set<Parsed_Event>();
            events.add(parsedEvent);
            this.reactionEvents.set(eventId, events);
        }

        await this.eventsAdapter.put(event);
        /* not await */ this.sourceOfChange.put({ event: parsedEvent, relay: url });
        return parsedEvent;
    }

    async addEvent_v2(event: Event_V2, url: URL) {
        console.log(event, url);
        this.events_v2.set(event.id, event);
        await this.recordRelay(event.id, url.toString());
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
        kind: event.kind,
        profile: profileData,
        parsedTags,
        publicKey,
    };
}
