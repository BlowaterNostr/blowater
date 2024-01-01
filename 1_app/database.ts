import { getTags, Parsed_Event, Profile_Nostr_Event } from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { parseJSON, ProfileData } from "./features/profile.ts";
import { NostrEvent, NostrKind, Tag, verifyEvent } from "../0_lib/nostr-ts/nostr.ts";
import { PublicKey } from "../0_lib/nostr-ts/key.ts";
import { ProfileController } from "./UI/search.tsx";

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

export class Datebase_View implements ProfileController, EventGetter, EventRemover, RelayRecordGetter {
    public readonly sourceOfChange = csp.chan<Parsed_Event>(buffer_size);
    private readonly caster = csp.multi<Parsed_Event>(this.sourceOfChange);
    private readonly profiles = new Map<string, Profile_Nostr_Event>();

    private constructor(
        private readonly eventsAdapter: EventsAdapter,
        private readonly relayRecorder: RelayRecorder,
        private readonly eventMarker: EventMarker,
        private readonly events: Map<string, Parsed_Event>,
        private readonly removedEvents: Set<string>,
        private readonly relayRecords: Map<string, Set<string>>,
    ) {}

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
        const all_relay_records = await relayAdapter.getAllRelayRecords();
        // Construct the View
        const db = new Datebase_View(
            eventsAdapter,
            relayAdapter,
            eventMarker,
            initialEvents,
            new Set(all_removed_events.map((mark) => mark.event_id)),
            all_relay_records,
        );
        console.log("Datebase_View:New time spent", Date.now() - t);
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

    get(keys: Indices): Parsed_Event | undefined {
        if (this.removedEvents.has(keys.id)) {
            return;
        }
        return this.events.get(keys.id);
    }

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

    getRelayRecord(eventID: string) {
        const relays = this.relayRecords.get(eventID);
        if (relays == undefined) {
            return new Set<string>();
        }
        return relays;
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

        const mark = await this.eventMarker.getMark(event.id);
        if (mark != undefined && mark.reason == "removed") {
            return false;
        }

        if (url) {
            await this.recordRelay(event.id, url);
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

        this.events.set(parsedEvent.id, parsedEvent);

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
        const res = csp.chan<Parsed_Event>(buffer_size);
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

    private async recordRelay(eventID: string, url: string) {
        const records = this.relayRecords.get(eventID);
        if (records) {
            records.add(url);
        } else {
            this.relayRecords.set(eventID, new Set([url]));
        }
        await this.relayRecorder.setRelayRecord(eventID, url);
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
