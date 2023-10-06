import { Database_Contextual_View } from "../database.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { NostrAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Parsed_Event, Profile_Nostr_Event } from "../nostr.ts";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { semaphore } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export class ProfileSyncer {
    readonly userSet = new Set<string>();
    private readonly lock = semaphore(1);

    constructor(
        private readonly database: Database_Contextual_View,
        private readonly pool: ConnectionPool,
    ) {
    }

    async add(...users: string[]) {
        const size = this.userSet.size;
        for (const user of users) {
            this.userSet.add(user);
        }
        if (this.userSet.size == size) {
            return;
        }
        const resp = await this.lock(async () => {
            await this.pool.closeSub(ProfileSyncer.name);
            const resp = await this.pool.newSub(ProfileSyncer.name, {
                authors: Array.from(this.userSet),
                kinds: [NostrKind.META_DATA],
            });
            return resp;
        });
        if (resp instanceof Error) {
            console.log(resp);
            return;
        }
        for await (let { res: nostrMessage, url: relayUrl } of resp.chan) {
            if (nostrMessage.type === "EVENT" && nostrMessage.event.content) {
                this.database.addEvent(nostrMessage.event);
            }
        }
    }
}

export async function saveProfile(
    profile: ProfileData,
    sender: NostrAccountContext,
    pool: ConnectionPool,
) {
    const event = await prepareNormalNostrEvent(
        sender,
        NostrKind.META_DATA,
        [],
        JSON.stringify(profile),
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
    const profileData = parseProfileData(event.content);
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

export function parseProfileData(content: string) {
    try {
        return JSON.parse(content) as ProfileData;
    } catch (e) {
        return e as Error;
    }
}
