import { ConversationListRetriever, ConversationType, GroupChatListGetter } from "./conversation-list.tsx";
import { PrivateKey, PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { getTags, Profile_Nostr_Event, Text_Note_Event } from "../nostr.ts";
import { ProfileSyncer } from "../features/profile.ts";

export interface ConversationSummary {
    pubkey: PublicKey;
    profile: Profile_Nostr_Event | undefined;
    newestEventSendByMe: NostrEvent | undefined;
    newestEventReceivedByMe: NostrEvent | undefined;
}

export function getConversationSummaryFromPublicKey(k: PublicKey, users: Map<string, ConversationSummary>) {
    return users.get(k.hex);
}

export class ConversationLists implements ConversationListRetriever, GroupChatListGetter {
    readonly convoSummaries = new Map<string, ConversationSummary>();
    readonly groupChatSummaries = new Map<string, ConversationSummary>();
    private readonly profile = new Map<string, Profile_Nostr_Event>();

    constructor(
        public readonly ctx: NostrAccountContext,
        private readonly profileSyncer: ProfileSyncer,
    ) {}

    *getStrangers() {
        for (const convoSummary of this.convoSummaries.values()) {
            if (
                (
                    convoSummary.newestEventReceivedByMe == undefined ||
                    convoSummary.newestEventSendByMe == undefined
                ) &&
                !(
                    convoSummary.newestEventReceivedByMe == undefined &&
                    convoSummary.newestEventSendByMe == undefined
                )
            ) {
                yield convoSummary;
            }
        }
    }

    *getContacts() {
        for (const userInfo of this.convoSummaries.values()) {
            if (
                userInfo.newestEventReceivedByMe != undefined &&
                userInfo.newestEventSendByMe != undefined
            ) {
                yield userInfo;
            }
        }
    }

    *getGroupChat() {
        for (const value of this.groupChatSummaries.values()) {
            yield value;
        }
    }

    getConversationType(pubkey: PublicKey) {
        const contact = this.convoSummaries.get(pubkey.hex);
        if (contact == undefined) {
            return "Strangers";
        }
        if (
            contact.newestEventReceivedByMe == undefined || contact.newestEventSendByMe == undefined
        ) {
            return "Strangers";
        } else {
            return "Contacts";
        }
    }

    async addEvents(
        events: (
            | Profile_Nostr_Event
            | Text_Note_Event
            | NostrEvent<NostrKind.DIRECT_MESSAGE>
            | NostrEvent<NostrKind.Group_Creation>
        )[],
    ) {
        // const t = Date.now();
        for (const event of events) {
            switch (event.kind) {
                case NostrKind.Group_Creation:
                    try {
                        const decryptedContent = await this.ctx.decrypt(event.pubkey, event.content);
                        if (decryptedContent instanceof Error) {
                            console.error(decryptedContent);
                            continue;
                        }
                        const content = JSON.parse(decryptedContent);
                        if (content.length == 0) {
                            continue;
                        }
                        const groupKey = PrivateKey.FromHex(content.groupKey.hex);
                        const cipherKey = PrivateKey.FromHex(content.cipherKey.hex);
                        if (groupKey instanceof Error || cipherKey instanceof Error) {
                            continue;
                        }

                        const publicKey = groupKey.toPublicKey();
                        this.groupChatSummaries.set(publicKey.hex, {
                            pubkey: publicKey,
                            newestEventReceivedByMe: undefined,
                            newestEventSendByMe: undefined,
                            profile: this.profile.get(publicKey.hex),
                        });
                        this.profileSyncer.add(publicKey.hex);
                    } catch (e) {
                        console.error(e);
                        continue; // do nothing
                    }
                    break;
                case NostrKind.META_DATA:
                    {
                        this.profile.set(event.publicKey.hex, event);
                        const convoSummary = this.convoSummaries.get(event.pubkey);
                        const groupChatSummary = this.groupChatSummaries.get(event.pubkey);
                        const profileEvent = event;

                        if (convoSummary) {
                            if (convoSummary.profile) {
                                if (profileEvent.created_at > convoSummary.profile?.created_at) {
                                    convoSummary.profile = profileEvent;
                                }
                            } else {
                                convoSummary.profile = profileEvent;
                            }
                        }

                        if (groupChatSummary) {
                            if (groupChatSummary.profile) {
                                if (profileEvent.created_at > groupChatSummary.profile?.created_at) {
                                    groupChatSummary.profile = profileEvent;
                                }
                            } else {
                                groupChatSummary.profile = profileEvent;
                            }
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
                        const userInfo = this.convoSummaries.get(whoAm_I_TalkingTo);
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
                            const newUserInfo: ConversationSummary = {
                                pubkey: PublicKey.FromHex(whoAm_I_TalkingTo) as PublicKey,
                                newestEventReceivedByMe: undefined,
                                newestEventSendByMe: undefined,
                                profile: this.profile.get(whoAm_I_TalkingTo),
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
                            this.convoSummaries.set(whoAm_I_TalkingTo, newUserInfo);
                        }
                    }
                    break;
            }
        }
    }
}

export const sortUserInfo = (a: ConversationSummary, b: ConversationSummary) => {
    return sortScore(b) - sortScore(a);
};

function sortScore(contact: ConversationSummary) {
    let score = 0;
    if (contact.newestEventSendByMe !== undefined) {
        score += contact.newestEventSendByMe.created_at;
    }
    if (contact.newestEventReceivedByMe !== undefined) {
        score += contact.newestEventReceivedByMe.created_at;
    }
    return score;
}
