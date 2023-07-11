import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database } from "../database.ts";
import {
    ConnectionPool,
    newSubID,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import {
    PublicKey,
    publicKeyHexFromNpub,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    groupBy,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    prepareNormalNostrEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { Tag } from "../nostr.ts";

// nip01 meta data
// https://github.com/nostr-protocol/nips/blob/master/05.md
// get the profile from a public key
export class UserMetaDataNotExist {
    constructor(
        public readonly publicKey: string,
        public readonly relay: string,
    ) {}
}

export function profilesStream(
    publicKeys: Iterable<string>,
    pool: ConnectionPool,
) {
    const chan = csp.chan<[NostrEvent, string]>();
    (async () => {
        let subId = newSubID();
        let resp = await pool.newSub(
            subId,
            {
                authors: Array.from(publicKeys),
                kinds: [NostrKind.META_DATA],
            },
        );
        if (resp instanceof Error) {
            throw resp;
        }
        for await (let { res: nostrMessage, url: relayUrl } of resp) {
            if (nostrMessage.type === "EVENT" && nostrMessage.event.content) {
                await chan.put([
                    nostrMessage.event,
                    relayUrl,
                ]);
            }
        }
        await chan.close(`pool sub has been clsoed`);
    })();
    return chan;
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

export function getProfileEvent(db: Database, pubkey: PublicKey): ProfileEvent | undefined {
    const events = Array.from(db.filterEvents((e) => {
        return e.kind === NostrKind.META_DATA && e.pubkey === pubkey.hex;
    }));
    if (events.length == 0) {
        return undefined;
    }
    events.sort((e1, e2) => e2.created_at - e1.created_at);
    const newest = events[0];
    return ProfileFromNostrEvent(newest);
}

export function getProfilesByName(db: Database, name: string): ProfileEvent[] {
    const events = Array.from(db.filterEvents((e) => {
        return e.kind === NostrKind.META_DATA;
    }));
    if (events.length == 0) {
        return [];
    }
    const profilesPerUser = groupBy(events, (e) => e.pubkey);

    const result = [];
    for (const events of profilesPerUser.values()) {
        events.sort((e1, e2) => e2.created_at - e1.created_at);
        const p = ProfileFromNostrEvent(events[0]);
        if (p.content.name && p.content.name?.toLocaleLowerCase().indexOf(name.toLowerCase()) != -1) {
            result.push(p);
        }
    }
    return result;
}

export function getProfiles(
    db: Database,
    pubkeys: Set<string>,
): Map<string, /*pubkey*/ ProfileEvent | undefined> {
    const contacts: Map<string, ProfileEvent | undefined> = new Map();
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

export interface ProfileEvent {
    kind: NostrKind;
    id: string;
    sig: string;
    created_at: number;
    pubkey: string;
    tags: Tag[];
    content: ProfileData;
}

export function ProfileFromNostrEvent(event: NostrEvent): ProfileEvent {
    let profileData: ProfileData = {};
    try {
        profileData = JSON.parse(event.content);
    } catch (e) {
        console.error(event.id, event.content, "is not valid JSON");
    }
    return {
        kind: event.kind,
        id: event.id,
        sig: event.sig,
        created_at: event.created_at,
        pubkey: event.pubkey,
        tags: event.tags,
        content: profileData,
    };
}
