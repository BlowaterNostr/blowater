import { ConversationListRetriever, ConversationType } from "./conversation-list.tsx";
import { InvalidKey, PrivateKey, PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { CustomAppData, getTags, Profile_Nostr_Event, Text_Note_Event } from "../nostr.ts";
import { GroupChatController } from "../group-chat.ts";

export interface ConversationSummary {
    pubkey: PublicKey;
    profile: Profile_Nostr_Event | undefined;
    newestEventSendByMe: NostrEvent | undefined;
    newestEventReceivedByMe: NostrEvent | undefined;
    isGroup?: boolean;
}

export function getConversationSummaryFromPublicKey(k: PublicKey, users: Map<string, ConversationSummary>) {
    return users.get(k.hex);
}

export class ConversationLists implements ConversationListRetriever {
    readonly convoSummaries = new Map<string, ConversationSummary>();
    readonly groupChatSummaries = new Map<string, ConversationSummary>();

    constructor(
        public readonly ctx: NostrAccountContext,
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

    async addEvents(
        events: (Profile_Nostr_Event | Text_Note_Event | NostrEvent<NostrKind.DIRECT_MESSAGE>)[] | NostrEvent<
            NostrKind.Custom_App_Data
        >[],
    ) {
        // const t = Date.now();
        for (const event of events) {
            switch (event.kind) {
                case NostrKind.Custom_App_Data:
                    const d = getTags(event).d;
                    if (d && d == GroupChatController.name) {
                        try {
                            const decryptedContent = await this.ctx.decrypt(event.pubkey, event.content);
                            if (decryptedContent instanceof Error) {
                                continue;
                            }
                            const content = JSON.parse(decryptedContent);
                            if (content.length == 0) {
                                continue;
                            }
                            for (const keys of content) {
                                const groupKey = keys.groupKey.hex;
                                const privateKey = PrivateKey.FromHex(groupKey);
                                if (privateKey instanceof Error) {
                                    continue;
                                }

                                this.groupChatSummaries.set(privateKey.toPublicKey().hex, {
                                    newestEventReceivedByMe: undefined,
                                    newestEventSendByMe: undefined,
                                    profile: undefined,
                                    pubkey: privateKey.toPublicKey(),
                                    isGroup: true,
                                });
                            }
                        } catch {
                            continue;
                        }
                    }
                    break;
                case NostrKind.META_DATA:
                    {
                        const userInfo = this.convoSummaries.get(event.pubkey);
                        const profileEvent = event;
                        if (userInfo) {
                            if (userInfo.profile) {
                                if (profileEvent.created_at > userInfo.profile?.created_at) {
                                    userInfo.profile = profileEvent;
                                }
                            } else {
                                userInfo.profile = profileEvent;
                            }
                        }
                        else {
                            const newUserInfo: ConversationSummary = {
                                pubkey: PublicKey.FromHex(event.pubkey) as PublicKey,
                                newestEventReceivedByMe: undefined,
                                newestEventSendByMe: undefined,
                                profile: profileEvent,
                            };
                            this.convoSummaries.set(event.pubkey, newUserInfo);
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

export function getGroupOf(
    pubkey: PublicKey,
    conversationLists: ConversationLists,
): ConversationType {
    console.log(pubkey, conversationLists.groupChatSummaries, conversationLists.convoSummaries, "=======");
    const convoSummary = conversationLists.convoSummaries.get(pubkey.hex);
    console.log(convoSummary, "+++++++++++++++++++++==========");
    if (convoSummary == undefined) {
        const groupChatSummary = conversationLists.groupChatSummaries.get(pubkey.hex);
        console.log(groupChatSummary, "++++++++");
        if (groupChatSummary == undefined) return "Strangers";
        return "Group";
    }
    if (
        convoSummary.newestEventReceivedByMe == undefined || convoSummary.newestEventSendByMe == undefined
    ) {
        return "Strangers";
    } else {
        return "Contacts";
    }
}
