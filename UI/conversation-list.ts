import { ConversationListRetriever, NewMessageChecker } from "./conversation-list.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { getTags, Parsed_Event } from "../nostr.ts";
import { InvalidEvent } from "../features/dm.ts";

export interface ConversationSummary {
    pubkey: PublicKey;
    newestEventSendByMe?: NostrEvent;
    newestEventReceivedByMe?: NostrEvent;
}

export class DM_List implements ConversationListRetriever, NewMessageChecker {
    readonly convoSummaries = new Map<string, ConversationSummary>();
    readonly newMessages = new Map<string, number>();

    constructor(
        public readonly ctx: NostrAccountContext,
    ) {}

    has(hex: string, isGourpChat: boolean): number {
        // return this.newMessages.get(hex) || 0;
        return 0;
    }

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

    getConversationType(pubkey: PublicKey, isGroupChat: boolean) {
        if (isGroupChat) {
            return "Group";
        }
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

    addEvents(
        events: NostrEvent[],
    ) {
        let i = 0;
        for (const event of events) {
            if (event.kind != NostrKind.DIRECT_MESSAGE) {
                continue;
            }

            let whoAm_I_TalkingTo = "";
            if (event.pubkey == this.ctx.publicKey.hex) {
                // I am the sender
                whoAm_I_TalkingTo = getTags(event).p[0];
                if (whoAm_I_TalkingTo == undefined) {
                    return new InvalidEvent(event, `event ${event.id} does not have p tags`);
                }
            } else if (getTags(event).p[0] == this.ctx.publicKey.hex) {
                // I am the receiver
                whoAm_I_TalkingTo = event.pubkey;
            } else {
                // I am neither. Possible because other user has used this device before
                continue;
            }

            this.newMessages.set(whoAm_I_TalkingTo, this.has(whoAm_I_TalkingTo, false) + 1);

            const userInfo = this.convoSummaries.get(whoAm_I_TalkingTo);
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
                const pubkey = PublicKey.FromHex(whoAm_I_TalkingTo);
                if (pubkey instanceof Error) {
                    return new InvalidEvent(event, pubkey.message);
                }
                const newUserInfo: ConversationSummary = {
                    pubkey,
                    newestEventReceivedByMe: undefined,
                    newestEventSendByMe: undefined,
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
