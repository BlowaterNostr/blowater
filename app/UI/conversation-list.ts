import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { InvalidEvent } from "../features/dm.ts";
import { getTags } from "../nostr.ts";
import { UserBlocker } from "./app_update.tsx";
import { ConversationListRetriever, ConversationType, NewMessageChecker } from "./conversation-list.tsx";

export interface ConversationSummary {
    pubkey: PublicKey;
    newestEventSendByMe?: NostrEvent;
    newestEventReceivedByMe?: NostrEvent;
}

export class DM_List implements ConversationListRetriever, NewMessageChecker, UserBlocker {
    readonly convoSummaries = new Map<string, ConversationSummary>();
    readonly newMessages = new Map<string, number>();

    constructor(
        public readonly ctx: NostrAccountContext,
    ) {}

    newNessageCount(pubkey: PublicKey, isGourpChat: boolean): number {
        return this.newMessages.get(pubkey.bech32()) || 0;
    }

    markRead(pubkey: PublicKey, isGourpChat: boolean): void {
        this.newMessages.set(pubkey.bech32(), 0);
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
                if (this.isUserBlocked(convoSummary.pubkey)) {
                    continue;
                }
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
                if (this.isUserBlocked(userInfo.pubkey)) {
                    continue;
                }
                yield userInfo;
            }
        }
    }

    getConversationType(pubkey: PublicKey, isGroupChat: boolean): ConversationType {
        if (isGroupChat) {
            return "Group";
        }
        const contact = this.convoSummaries.get(pubkey.bech32());
        if (contact == undefined) {
            return "strangers";
        }
        if (this.isUserBlocked(pubkey)) {
            return "blocked";
        }
        if (
            contact.newestEventReceivedByMe == undefined || contact.newestEventSendByMe == undefined
        ) {
            return "strangers";
        } else {
            return "contacts";
        }
    }

    *getConversations(keys: Iterable<string>): Iterable<ConversationSummary> {
        for (const key of keys) {
            const convo = this.convoSummaries.get(key);
            if (convo) {
                yield convo;
            }
        }
    }

    ///////////////////////////
    // implement UserBlocker //
    ///////////////////////////
    blockUser(pubkey: PublicKey): void {
        let blockedUsers = this.getBlockedUsers();
        blockedUsers.add(pubkey.bech32());
        localStorage.setItem("blocked-users", JSON.stringify(Array.from(blockedUsers)));
    }
    unblockUser(pubkey: PublicKey): void {
        let blockedUsers = this.getBlockedUsers();
        blockedUsers.delete(pubkey.bech32());
        localStorage.setItem("blocked-users", JSON.stringify(Array.from(blockedUsers)));
    }
    isUserBlocked(pubkey: PublicKey): boolean {
        const blockedUsers = this.getBlockedUsers();
        return blockedUsers.has(pubkey.bech32());
    }
    getBlockedUsers() {
        let blockedUsers: string | null = localStorage.getItem("blocked-users");
        if (blockedUsers == null) {
            blockedUsers = "[]";
        }
        return new Set(JSON.parse(blockedUsers) as string[]);
    }
    // end //
    /////////

    addEvents(
        events: NostrEvent[],
        newEvents: boolean,
    ) {
        for (const event of events) {
            if (event.kind != NostrKind.DIRECT_MESSAGE) {
                continue;
            }
            const err = this.addEvent({
                ...event,
                kind: event.kind,
            }, newEvents);
            if (err instanceof Error) {
                return err;
            }
        }
    }

    private addEvent(event: NostrEvent<NostrKind.DIRECT_MESSAGE>, newEvent: boolean) {
        let pubkey_I_TalkingTo;
        {
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
                return;
            }
            pubkey_I_TalkingTo = PublicKey.FromHex(whoAm_I_TalkingTo);
            if (pubkey_I_TalkingTo instanceof Error) {
                return new InvalidEvent(event, pubkey_I_TalkingTo.message);
            }
        }

        if (newEvent && this.ctx.publicKey.hex != event.pubkey) {
            this.newMessages.set(
                pubkey_I_TalkingTo.bech32(),
                this.newNessageCount(pubkey_I_TalkingTo, false) + 1,
            );
        }

        const userInfo = this.convoSummaries.get(pubkey_I_TalkingTo.bech32());
        if (userInfo) {
            if (pubkey_I_TalkingTo.hex == this.ctx.publicKey.hex) {
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
                pubkey: pubkey_I_TalkingTo,
                newestEventReceivedByMe: undefined,
                newestEventSendByMe: undefined,
            };
            if (pubkey_I_TalkingTo.hex == this.ctx.publicKey.hex) {
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
            this.convoSummaries.set(pubkey_I_TalkingTo.bech32(), newUserInfo);
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
