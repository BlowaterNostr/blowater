import { ContactGroup, ConversationListRetriever } from "./contact-list.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { CustomAppData, getTags, Profile_Nostr_Event, Text_Note_Event } from "../nostr.ts";

export interface UserInfo {
    pubkey: PublicKey;
    profile: Profile_Nostr_Event | undefined;
    newestEventSendByMe: NostrEvent | undefined;
    newestEventReceivedByMe: NostrEvent | undefined;
    pinEvent: {
        readonly created_at: number;
        readonly content: CustomAppData;
    } | undefined;
}

export function getUserInfoFromPublicKey(k: PublicKey, users: Map<string, UserInfo>) {
    const userInfo = users.get(k.hex);
    return userInfo;
}

export class AllUsersInformation implements ConversationListRetriever {
    readonly userInfos = new Map<string, UserInfo>();

    constructor(public readonly ctx: NostrAccountContext) {}

    *getStrangers() {
        for (const userInfo of this.userInfos.values()) {
            if (
                userInfo.newestEventReceivedByMe == undefined ||
                userInfo.newestEventSendByMe == undefined
            ) {
                yield userInfo;
            }
        }
    }

    *getContacts() {
        for (const userInfo of this.userInfos.values()) {
            if (
                userInfo.newestEventReceivedByMe != undefined &&
                userInfo.newestEventSendByMe != undefined
            ) {
                yield userInfo;
            }
        }
    }

    addEvents(events: (Profile_Nostr_Event | Text_Note_Event | NostrEvent<NostrKind.DIRECT_MESSAGE>)[]) {
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
                                // events: [],
                            };
                            this.userInfos.set(event.pubkey, newUserInfo);
                        }
                    }
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
                            // userInfo.events.push(event);
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
                                // events: [event],
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
