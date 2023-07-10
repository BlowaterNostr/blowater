import { Database } from "../database.ts";
import { ProfileEvent, ProfileFromNostrEvent, profilesStream } from "../features/profile.ts";

import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { ContactGroup } from "./contact-list.tsx";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    NostrAccountContext,
    NostrEvent,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import {
    ConnectionPool,
    newSubID,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { CustomAppData, getTags } from "../nostr.ts";
import { assertEquals } from "https://deno.land/std@0.176.0/testing/asserts.ts";

export interface UserInfo {
    pubkey: PublicKey;
    profile: ProfileEvent | undefined; // todo: maybe change it to ProfileEvent
    newestEventSendByMe: NostrEvent | undefined;
    newestEventReceivedByMe: NostrEvent | undefined;
    pinEvent: {
        readonly created_at: number;
        readonly content: CustomAppData;
    } | undefined;
}

export class ProfilesSyncer {
    readonly userSet = new Set<string>();

    private chan = new Channel<string[]>();

    constructor(
        private readonly database: Database,
        private readonly pool: ConnectionPool,
    ) {
        (async () => {
            let stream = profilesStream(this.userSet, pool);
            let socialPosts = socialPostsStream(this.userSet, pool);
            database.syncEvents((e) => e.kind == NostrKind.META_DATA, stream);
            database.syncEvents((e) => e.kind == NostrKind.TEXT_NOTE, socialPosts);
            for await (const users of this.chan) {
                const size = this.userSet.size;
                for (const user of users) {
                    this.userSet.add(user);
                }
                if (this.userSet.size > size) {
                    console.log("adding", users);
                    await stream.close();
                    await socialPosts.close();
                    stream = profilesStream(this.userSet, pool);
                    socialPosts = socialPostsStream(this.userSet, pool);
                    database.syncEvents((e) => e.kind == NostrKind.META_DATA, stream);
                    database.syncEvents((e) => e.kind == NostrKind.TEXT_NOTE, socialPosts);
                }
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

function socialPostsStream(pubkeys: Iterable<string>, pool: ConnectionPool) {
    const chan = new Channel<{ event: NostrEvent; url: string }>();
    let subId = newSubID();
    (async () => {
        let resp = await pool.newSub(
            subId,
            {
                authors: Array.from(pubkeys),
                kinds: [NostrKind.TEXT_NOTE],
                limit: 100, // todo: should use time
            },
        );
        if (resp instanceof Error) {
            await chan.close(resp.message);
            throw resp;
        }
        for await (let { res: nostrMessage, url: relayUrl } of resp) {
            if (nostrMessage.type === "EVENT" && nostrMessage.event.content) {
                const event = nostrMessage.event;
                await chan.put({
                    event: event,
                    url: relayUrl,
                });
            }
        }
        console.log("closed");
    })();
    return chan;
}

export function getAllUsersInformation(
    database: Database,
    myAccountContext: NostrAccountContext,
): Map<string, UserInfo> {
    const t = Date.now();
    const res = new Map<string, UserInfo>();
    {
        for (const event of database.filterEvents((_) => true)) {
            switch (event.kind) {
                case NostrKind.META_DATA:
                    {
                        const userInfo = res.get(event.pubkey);
                        const profileEvent = ProfileFromNostrEvent(event);
                        if (userInfo) {
                            if (userInfo.profile) {
                                if (profileEvent.created_at > userInfo.profile?.created_at) {
                                    userInfo.profile = profileEvent;
                                }
                            } else {
                                userInfo.profile = profileEvent;
                            }
                        } else {
                            const newUserInfo: UserInfo = {
                                pinEvent: undefined,
                                pubkey: PublicKey.FromHex(event.pubkey) as PublicKey,
                                newestEventReceivedByMe: undefined,
                                newestEventSendByMe: undefined,
                                profile: undefined,
                            };
                            newUserInfo.profile = profileEvent;
                            res.set(event.pubkey, newUserInfo);
                        }
                    }
                    break;
                case NostrKind.TEXT_NOTE:
                    break;
                case NostrKind.RECOMMED_SERVER:
                    break;
                case NostrKind.CONTACTS:
                    break;
                case NostrKind.DIRECT_MESSAGE:
                    {
                        let whoAm_I_TalkingTo = "";
                        if (event.pubkey == myAccountContext.publicKey.hex) {
                            // I am the sender
                            whoAm_I_TalkingTo = getTags(event).p[0];
                        } else if (getTags(event).p[0] == myAccountContext.publicKey.hex) {
                            // I am the receiver
                            whoAm_I_TalkingTo = event.pubkey;
                        } else {
                            // I am neither. Possible because other user has used this device before
                            break;
                        }
                        const userInfo = res.get(whoAm_I_TalkingTo);
                        if (userInfo) {
                            if (whoAm_I_TalkingTo == myAccountContext.publicKey.hex) {
                                // talking to myself
                                if (userInfo.newestEventSendByMe) {
                                    if (event.created_at > userInfo.newestEventSendByMe?.created_at) {
                                        userInfo.newestEventSendByMe = event;
                                        userInfo.newestEventReceivedByMe = event;
                                    }
                                } else {
                                    userInfo.newestEventSendByMe = event;
                                    userInfo.newestEventReceivedByMe = event;
                                }
                            } else {
                                if (myAccountContext.publicKey.hex == event.pubkey) {
                                    // I am the sender
                                    if (userInfo.newestEventSendByMe) {
                                        if (event.created_at > userInfo.newestEventSendByMe.created_at) {
                                            userInfo.newestEventSendByMe = event;
                                        }
                                    } else {
                                        userInfo.newestEventSendByMe = event;
                                    }
                                } else {
                                    // I am the receiver
                                    if (userInfo.newestEventReceivedByMe) {
                                        if (event.created_at > userInfo.newestEventReceivedByMe.created_at) {
                                            userInfo.newestEventReceivedByMe = event;
                                        }
                                    } else {
                                        userInfo.newestEventReceivedByMe = event;
                                    }
                                }
                            }
                        } else {
                            const newUserInfo: UserInfo = {
                                pubkey: PublicKey.FromHex(whoAm_I_TalkingTo) as PublicKey,
                                pinEvent: undefined,
                                newestEventReceivedByMe: undefined,
                                newestEventSendByMe: undefined,
                                profile: undefined,
                            };
                            if (whoAm_I_TalkingTo == myAccountContext.publicKey.hex) {
                                // talking to myself
                                newUserInfo.newestEventSendByMe = event;
                                newUserInfo.newestEventReceivedByMe = event;
                            } else {
                                if (myAccountContext.publicKey.hex == event.pubkey) {
                                    // I am the sender
                                    newUserInfo.newestEventSendByMe = event;
                                } else {
                                    // I am the receiver
                                    newUserInfo.newestEventReceivedByMe = event;
                                }
                            }
                            res.set(whoAm_I_TalkingTo, newUserInfo);
                        }
                    }
                    break;
                case NostrKind.DELETE:
                    break;
                case NostrKind.CustomAppData: {
                    const obj: CustomAppData = JSON.parse(event.content);
                    if (obj.type == "PinContact" || obj.type == "UnpinContact") {
                        const userInfo = res.get(obj.pubkey);
                        if (userInfo) {
                            if (userInfo.pinEvent) {
                                if (event.created_at > userInfo.pinEvent.created_at) {
                                    userInfo.pinEvent = {
                                        content: obj,
                                        created_at: event.created_at,
                                    };
                                }
                            } else {
                                userInfo.pinEvent = {
                                    content: obj,
                                    created_at: event.created_at,
                                };
                            }
                        } else {
                            res.set(obj.pubkey, {
                                pubkey: PublicKey.FromHex(obj.pubkey) as PublicKey, // todo: could throw
                                pinEvent: {
                                    content: obj,
                                    created_at: event.created_at,
                                },
                                newestEventReceivedByMe: undefined,
                                newestEventSendByMe: undefined,
                                profile: undefined,
                            });
                        }
                    }
                }
            }
        }
    }
    // todo: should write a unit test for it instead of runtime assertion
    for (const [pubkey, userInfo] of res) {
        assertEquals(pubkey, userInfo.pubkey.hex);
        if (userInfo.profile) {
            assertEquals(pubkey, userInfo.profile.pubkey);
        }
    }

    console.log("getAllUsersInformation", Date.now() - t);
    return res;
}

export const sortUserInfo = (a: UserInfo, b: UserInfo) => {
    return sortScore(b) - sortScore(a);
};

function sortScore(contact: UserInfo) {
    let score = 0;
    if (contact.newestEventSendByMe !== undefined) {
        score += contact.newestEventSendByMe.created_at;
    }
    if (contact.newestEventReceivedByMe !== undefined) {
        score += contact.newestEventReceivedByMe.created_at;
    }
    return score;
}

export function getGroupOf(pubkey: PublicKey, allUserInfo: Map<string, UserInfo>): ContactGroup {
    const contact = allUserInfo.get(pubkey.hex);
    if (contact == undefined) {
        return "Strangers";
    }
    console.log(contact);
    if (
        contact.newestEventReceivedByMe == undefined || contact.newestEventSendByMe == undefined
    ) {
        return "Strangers";
    } else {
        return "Contacts";
    }
}
