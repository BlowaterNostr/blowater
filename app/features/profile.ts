import { Parsed_Event, Profile_Nostr_Event } from "../nostr.ts";
import { prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";

import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { NostrAccountContext, NostrKind } from "../../libs/nostr.ts/nostr.ts";

export async function saveProfile(
    profile: ProfileData,
    sender: NostrAccountContext,
    pool: ConnectionPool,
) {
    const event = await prepareNormalNostrEvent(
        sender,
        { kind: NostrKind.META_DATA, content: JSON.stringify(profile) },
    );
    pool.sendEvent(event);
}

// aka user profile
export interface ProfileData {
    name?: string;
    picture?: string;
    about?: string;
    website?: string;
    banner?: string;
    [key: string]: string | undefined;
}

export function ProfileFromNostrEvent(
    event: Parsed_Event<NostrKind.META_DATA>,
) {
    const profileData = parseJSON<ProfileData>(event.content);
    if (profileData instanceof Error) {
        return profileData;
    }
    const e: Profile_Nostr_Event = {
        kind: event.kind,
        id: event.id,
        sig: event.sig,
        created_at: event.created_at,
        pubkey: event.pubkey,
        tags: event.tags,
        content: event.content,
        parsedTags: event.parsedTags,
        profile: profileData,
        publicKey: event.publicKey,
    };
    return e;
}

export function parseJSON<T>(content: string): T | Error {
    try {
        return JSON.parse(content) as T;
    } catch (e) {
        return e as Error;
    }
}
