import { Database_Contextual_View } from "../database.ts";
import { ConnectionPool, SingleRelayConnection } from "../lib/nostr-ts/relay.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { groupBy, NostrAccountContext, NostrKind, prepareNormalNostrEvent } from "../lib/nostr-ts/nostr.ts";
import { Parsed_Event, Profile_Nostr_Event } from "../nostr.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export class ProfilesSyncer {
    readonly userSet = new Set<string>();

    private chan = new Channel<string[]>();

    constructor(
        private readonly database: Database_Contextual_View,
        private readonly pool: SingleRelayConnection,
    ) {
        (async () => {
            for await (const users of this.chan) {
                const size = this.userSet.size;
                for (const user of users) {
                    this.userSet.add(user);
                }
                if (this.userSet.size == size) {
                    continue;
                }
                console.log("adding", users);
                const resp = await pool.newSub(
                    "profilesStream",
                    {
                        authors: Array.from(this.userSet),
                        kinds: [NostrKind.META_DATA],
                    },
                );

                if (resp instanceof Error) {
                    console.error(resp.message);
                    return;
                }
                console.log("\\\\", pool);
                // for await (let { res: nostrMessage, url: relayUrl } of resp.chan) {
                for await (const nostrMessage of resp.chan) {
                    console.log("res", nostrMessage);
                    if (nostrMessage.type === "EVENT" && nostrMessage.event.content) {
                        database.addEvent(nostrMessage.event);
                    }
                    // if (nostrMessage.type == "EOSE") {
                    //     break;
                    // }
                }
                throw "not"
                // await resp.chan.close();
            }
        })();
    }

    async add(...users: string[]) {
        const err = await this.chan.put(users);
        if (err instanceof Error) {
            throw err; // impossible
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

export function getProfileEvent(
    db: Database_Contextual_View,
    pubkey: PublicKey,
): Profile_Nostr_Event | undefined {
    const events: Profile_Nostr_Event[] = [];
    for (const e of db.events) {
        if (e.kind === NostrKind.META_DATA && e.pubkey === pubkey.hex) {
            events.push(e);
        }
    }
    if (events.length == 0) {
        return undefined;
    }
    events.sort((e1, e2) => e2.created_at - e1.created_at);
    const newest = events[0];
    return newest;
}

export function getProfilesByName(db: Database_Contextual_View, name: string): Profile_Nostr_Event[] {
    const events: Profile_Nostr_Event[] = [];
    for (const e of db.events) {
        if (e.kind === NostrKind.META_DATA) {
            events.push(e);
        }
    }
    if (events.length == 0) {
        return [];
    }
    const profilesPerUser = groupBy(events, (e) => e.pubkey);

    const result = [];
    for (const events of profilesPerUser.values()) {
        events.sort((e1, e2) => e2.created_at - e1.created_at);
        const p = events[0];
        if (p.profile.name && p.profile.name?.toLocaleLowerCase().indexOf(name.toLowerCase()) != -1) {
            result.push(p);
        }
    }
    return result;
}

export function getProfiles(
    db: Database_Contextual_View,
    pubkeys: Set<string>,
): Map<string, /*pubkey*/ Profile_Nostr_Event | undefined> {
    const contacts: Map<string, Profile_Nostr_Event | undefined> = new Map();
    for (const key of pubkeys) {
        const event = getProfileEvent(db, PublicKey.FromHex(key) as PublicKey);
        contacts.set(key, event);
    }
    return contacts;
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
