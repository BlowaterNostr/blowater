import { Database_View, EventMark, EventMarker, EventsAdapter, Indices, RelayRecorder } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { NostrAccountContext, NostrEvent, NostrKind, prepareNormalNostrEvent } from "@blowater/nostr-sdk";
import { UI_Interaction_Event } from "./app_update.tsx";
import { Profile_Nostr_Event } from "../nostr.ts";
import { ProfileData } from "../features/profile.ts";

export const testEventBus = new EventBus<UI_Interaction_Event>();

export async function test_db_view() {
    const data = new Map();
    const testEventsAdapter: EventsAdapter = {
        filter: async () => {
            const events = [];
            for (const v of data.values()) {
                events.push(v);
            }
            return events;
        },
        get: async (keys: Indices) => {
            return data.get(keys.id);
        },
        put: async (e: NostrEvent) => {
            data.set(e.id, e);
        },
    };

    const relays = new Map<string, Set<string>>();
    const testRelayRecorder: RelayRecorder = {
        setRelayRecord: async (eventID: string, url: string) => {
            const records = relays.get(eventID);
            if (records) {
                records.add(url);
            } else {
                relays.set(eventID, new Set([url]));
            }
        },
        getAllRelayRecords: async () => {
            return relays;
        },
    };

    const marks = new Map<string, EventMark>();
    const testEventMarker: EventMarker = {
        getMark: async (eventID: string) => {
            return marks.get(eventID);
        },
        async markEvent(eventID: string, reason: "removed") {
            marks.set(eventID, {
                event_id: eventID,
                reason: reason,
            });
        },
        async getAllMarks() {
            return Array.from(marks.values());
        },
    };
    return await Database_View.New(testEventsAdapter, testRelayRecorder, testEventMarker);
}

export const prepareProfileEvent = async (
    author: NostrAccountContext,
    profile: ProfileData,
) => {
    const profileEvent = await prepareNormalNostrEvent(author, {
        kind: NostrKind.META_DATA,
        content: JSON.stringify(profile),
    }) as NostrEvent<NostrKind.META_DATA>;
    return {
        ...profileEvent,
        profile,
        publicKey: author.publicKey,
        parsedTags: {
            p: [],
            e: [],
        },
    } as Profile_Nostr_Event;
};
