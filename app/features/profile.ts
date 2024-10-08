import {
    NostrAccountContext,
    NostrKind,
    prepareNostrEvent,
    SingleRelayConnection,
} from "@blowater/nostr-sdk";

export async function saveProfile(
    profile: ProfileData,
    sender: NostrAccountContext,
    relay: SingleRelayConnection,
) {
    const event = await prepareNostrEvent(
        sender,
        { kind: NostrKind.META_DATA, content: JSON.stringify(profile) },
    );
    if (event instanceof Error) {
        return event;
    }
    return relay.sendEvent(event);
}

// aka user profile
export interface ProfileData {
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
    website?: string;
    banner?: string;
    [key: string]: string | undefined;
}

export function parseJSON<T>(content: string): T | Error {
    try {
        return JSON.parse(content) as T;
    } catch (e) {
        return e as Error;
    }
}
