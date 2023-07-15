import { Database_Contextual_View } from "../database.ts";
import { profilesStream } from "../features/profile.ts";

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
import {
    CustomAppData,
    Decrypted_Nostr_Event,
    getTags,
    PlainText_Nostr_Event,
    Profile_Nostr_Event,
} from "../nostr.ts";

export interface UserInfo {
    pubkey: PublicKey;
    profile: Profile_Nostr_Event | undefined; // todo: maybe change it to ProfileEvent
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
        private readonly database: Database_Contextual_View,
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
    const chan = new Channel<[NostrEvent, string]>();
    let subId = newSubID();
    (async () => {
        let resp = await pool.newSub(
            subId,
            {
                authors: Array.from(pubkeys),
                kinds: [NostrKind.TEXT_NOTE],
                limit: 200,
            },
        );
        if (resp instanceof Error) {
            await chan.close(resp.message);
            throw resp;
        }
        for await (let { res: nostrMessage, url: relayUrl } of resp) {
            if (nostrMessage.type === "EVENT" && nostrMessage.event.content) {
                const event = nostrMessage.event;
                await chan.put([
                    event,
                    relayUrl,
                ]);
            }
        }
        console.log("closed");
    })();
    return chan;
}

export class AllUsersInformation {
    readonly userInfos = new Map<string, UserInfo>();

    constructor(public readonly ctx: NostrAccountContext) {}

    addEvents(events: (Profile_Nostr_Event | PlainText_Nostr_Event | Decrypted_Nostr_Event)[]) {
        // const t = Date.now();
        for (const event of events) {
            switch (event.kind) {
                case NostrKind.META_DATA:
                    {
                        const userInfo = this.userInfos.get(event.pubkey);
                        const profileEvent = event;
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
                                profile: profileEvent,
                            };
                            this.userInfos.set(event.pubkey, newUserInfo);
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
                        if (event.pubkey == this.ctx.publicKey.hex) {
                            // I am the sender
                            whoAm_I_TalkingTo = getTags(event).p[0];
                        } else if (getTags(event).p[0] == this.ctx.publicKey.hex) {
                            // I am the receiver
                            whoAm_I_TalkingTo = event.pubkey;
                        } else {
                            // I am neither. Possible because other user has used this device before
                            break;
                        }
                        const userInfo = this.userInfos.get(whoAm_I_TalkingTo);
                        if (userInfo) {
                            if (whoAm_I_TalkingTo == this.ctx.publicKey.hex) {
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
                                if (this.ctx.publicKey.hex == event.pubkey) {
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
                            if (whoAm_I_TalkingTo == this.ctx.publicKey.hex) {
                                // talking to myself
                                newUserInfo.newestEventSendByMe = event;
                                newUserInfo.newestEventReceivedByMe = event;
                            } else {
                                if (this.ctx.publicKey.hex == event.pubkey) {
                                    // I am the sender
                                    newUserInfo.newestEventSendByMe = event;
                                } else {
                                    // I am the receiver
                                    newUserInfo.newestEventReceivedByMe = event;
                                }
                            }
                            this.userInfos.set(whoAm_I_TalkingTo, newUserInfo);
                        }
                    }
                    break;
                case NostrKind.DELETE:
                    break;
                case NostrKind.CustomAppData: {
                    if (event.kind == NostrKind.CustomAppData) {
                        event;
                    }
                    const obj: CustomAppData = JSON.parse(event.decryptedContent);
                    if (obj.type == "PinContact" || obj.type == "UnpinContact") {
                        const userInfo = this.userInfos.get(obj.pubkey);
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
                            this.userInfos.set(obj.pubkey, {
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
        // console.log("AllUsersInformation:addEvents", Date.now() - t);
    }
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
