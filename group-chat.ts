import { z } from "https://esm.sh/zod@3.22.4";
import { ConversationLists, ConversationSummary } from "./UI/conversation-list.ts";
import { ProfileSyncer, parseJSON } from "./features/profile.ts";
import { prepareEncryptedNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";
import { GroupMessageGetter } from "./UI/app_update.tsx";
import { getTags } from "./nostr.ts";
import { ChatMessage } from "./UI/message.ts";
import { GroupChatListGetter } from "./UI/conversation-list.tsx";
import { Channel, semaphore } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { ConnectionPool } from "./lib/nostr-ts/relay.ts";
import { Database_Contextual_View } from "./database.ts";

export type GM_Types = "gm_creation" | "gm_message" | "gm_invitation";

export type GroupMessage = {
    event: NostrEvent<NostrKind.Group_Message>;
};

export type GroupChatCreation = {
    cipherKey: InMemoryAccountContext;
    groupKey: InMemoryAccountContext;
};

export type GroupChatInvitation = {
    cipherKey: InMemoryAccountContext;
    groupAddr: PublicKey;
};

export class GroupChatController implements GroupMessageGetter, GroupChatListGetter {
    created_groups = new Map<string, GroupChatCreation>();
    invitations = new Map<string, GroupChatInvitation>();
    messages = new Map<string, ChatMessage[]>();
    resync_chan = new Channel<null>();

    constructor(
        private readonly ctx: NostrAccountContext,
        private readonly conversationLists: ConversationLists,
        private readonly groupSyncer: GroupChatSyncer,
        private readonly profileSyncer: ProfileSyncer
    ) {}

    getGroupChat() {
        const conversations: ConversationSummary[] = [];
        for (const v of this.created_groups.values()) {
            conversations.push({
                pubkey: v.groupKey.publicKey,
                newestEventReceivedByMe: undefined,
                newestEventSendByMe: undefined, // todo
            });
        }
        for (const v of this.invitations.values()) {
            conversations.push({
                pubkey: v.groupAddr,
                newestEventReceivedByMe: undefined,
                newestEventSendByMe: undefined, // todo
            });
        }
        return conversations;
    }

    getGroupMessages(publicKey: string): ChatMessage[] {
        const msgs = this.messages.get(publicKey);
        return msgs ? msgs : [];
    }

    async encodeCreationToNostrEvent(groupCreation: GroupChatCreation) {
        const event = prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Group_Message,
            tags: [],
            content: JSON.stringify({
                type: "gm_creation",
                cipherKey: groupCreation.cipherKey.privateKey.bech32,
                groupKey: groupCreation.groupKey.privateKey.bech32,
            }),
        });
        return event;
    }

    createGroupChat() {
        const groupChatCreation: GroupChatCreation = {
            cipherKey: InMemoryAccountContext.New(PrivateKey.Generate()),
            groupKey: InMemoryAccountContext.New(PrivateKey.Generate()),
        };
        this.created_groups.set(groupChatCreation.groupKey.publicKey.bech32(), groupChatCreation);
        this.groupSyncer.add(groupChatCreation.groupKey.publicKey.hex)
        this.profileSyncer.add(groupChatCreation.groupKey.publicKey.hex)
        return groupChatCreation;
    }

    async addEvent(event: NostrEvent<NostrKind.Group_Message>) {
        const type = await eventType(this.ctx, event);
        if (type instanceof Error) {
            return type;
        }

        if (type == "gm_creation") {
            return await this.handleCreation(event);
        } else if (type == "gm_message") {
            return await this.handleMessage(event);
        } else if (type == "gm_invitation") { // I received
            return await this.handleInvitation(event);
        } else {
            console.log(GroupChatController.name, "ignore", event, "type", type);
        }
    }

    async addEvents(...events: NostrEvent<NostrKind.Group_Message>[]) {
        for (const e of events) {
            const err = await this.addEvent(e);
            if (err instanceof Error) {
                return err;
            }
        }
    }

    async handleInvitation(event: NostrEvent<NostrKind.Group_Message>) {
        const decryptedContent = await this.ctx.decrypt(event.pubkey, event.content);
        if (decryptedContent instanceof Error) {
            return decryptedContent;
        }

        const json = parseJSON<unknown>(decryptedContent);
        if (json instanceof Error) {
            return json;
        }

        const author = PublicKey.FromHex(event.pubkey);
        if (author instanceof Error) {
            return author;
        }

        let message: {
            type: string;
            cipherKey: string;
            groupAddr: string;
        };
        try {
            message = z.object({
                type: z.string(),
                cipherKey: z.string(),
                groupAddr: z.string(),
            }).parse(json);
        } catch (e) {
            return e as Error;
        }

        // add invitations
        const cipherKey = PrivateKey.FromBech32(message.cipherKey);
        if (cipherKey instanceof Error) {
            return cipherKey;
        }
        const groupAddr = PublicKey.FromBech32(message.groupAddr);
        if (groupAddr instanceof Error) {
            return groupAddr;
        }
        const invitation: GroupChatInvitation = {
            cipherKey: InMemoryAccountContext.New(cipherKey),
            groupAddr,
        };
        this.invitations.set(groupAddr.bech32(), invitation);
        this.groupSyncer.add(groupAddr.hex)
        this.profileSyncer.add(groupAddr.hex)
    }

    async handleMessage(event: NostrEvent<NostrKind.Group_Message>) {
        const groupAddr = getTags(event).p[0];
        const groupAddrPubkey = PublicKey.FromHex(groupAddr);
        if (groupAddrPubkey instanceof Error) {
            return groupAddrPubkey;
        }
        const groupChatCtx = this.getGroupChatCtx(groupAddrPubkey);
        if (groupChatCtx == undefined) {
            console.log(groupAddrPubkey);
            console.log(this.created_groups);
            return new Error(`group ${groupAddr} does not have me in it`);
        }
        const decryptedContent = await groupChatCtx.decrypt(event.pubkey, event.content);
        if (decryptedContent instanceof Error) {
            return decryptedContent;
        }

        const json = parseJSON<unknown>(decryptedContent);
        if (json instanceof Error) {
            return json;
        }

        const author = PublicKey.FromHex(event.pubkey);
        if (author instanceof Error) {
            return author;
        }

        let message;
        try {
            message = z.object({
                type: z.string(),
                text: z.string(),
            }).parse(json);
        } catch (e) {
            message = e as Error;
        }
        if (message instanceof Error) {
            return message;
        }

        const chatMessage: ChatMessage = {
            event: event,
            author: author,
            content: message.text,
            created_at: new Date(event.created_at * 1000),
            lamport: getTags(event).lamport_timestamp,
            type: "text",
        };

        const messages = this.messages.get(groupAddr);
        if (messages) {
            messages.push(chatMessage);
        } else {
            this.messages.set(groupAddr, [chatMessage]);
        }
    }

    async handleCreation(event: NostrEvent<NostrKind.Group_Message>) {
        const decryptedContent = await this.ctx.decrypt(event.pubkey, event.content);
        if (decryptedContent instanceof Error) {
            return decryptedContent;
        }

        const json = parseJSON<unknown>(decryptedContent);
        if (json instanceof Error) {
            return json;
        }

        try {
            const schema = z.object({
                type: z.string(),
            });
            const content = schema.parse(json);
            if (content.type == "gm_creation") {
                const schema = z.object({
                    type: z.string(),
                    cipherKey: z.string(),
                    groupKey: z.string(),
                });
                const content = schema.parse(json);
                const groupKey = PrivateKey.FromString(content.groupKey);
                if (groupKey instanceof Error) {
                    return groupKey;
                }
                const cipherKey = PrivateKey.FromString(content.cipherKey);
                if (cipherKey instanceof Error) {
                    return cipherKey;
                }

                const groupChatCreation = {
                    groupKey: InMemoryAccountContext.New(groupKey),
                    cipherKey: InMemoryAccountContext.New(cipherKey),
                };
                this.created_groups.set(groupKey.toPublicKey().bech32(), groupChatCreation);
                this.groupSyncer.add(groupKey.toPublicKey().hex)
                this.profileSyncer.add(groupKey.toPublicKey().hex)

                this.conversationLists.addGroupCreation(groupChatCreation);
            } else if (content.type == "gm_message") {
                console.log(content);
            }
        } catch (e) {
            return e as Error;
        }
    }

    getGroupChatCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const creation = this.created_groups.get(group_addr.bech32());
        if (creation == undefined) {
            const invitation = this.invitations.get(group_addr.bech32());
            if (invitation == undefined) {
                return undefined;
            }
            return invitation.cipherKey;
        }
        return creation.cipherKey;
    }

    getGroupAdminCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const creation = this.created_groups.get(group_addr.bech32());
        if (!creation) {
            return;
        }
        return creation.groupKey;
    }

    async createInvitation(groupAddr: PublicKey, invitee: PublicKey) {
        // It has to be a group that I created
        const group = this.created_groups.get(groupAddr.bech32());
        if (group == undefined) {
            return new Error(`You are not the admin of ${groupAddr.bech32()}`);
        }
        // create the invitation event
        const invitation = {
            type: "gm_invitation",
            cipherKey: group.cipherKey.privateKey.bech32,
            groupAddr: group.groupKey.publicKey.bech32(),
        };
        const event = await prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: invitee,
            kind: NostrKind.Group_Message,
            content: JSON.stringify(invitation),
            tags: [
                ["p", invitee.hex],
            ],
        });
        return event;
    }
}

function isCreation(event: NostrEvent<NostrKind.Group_Message>) {
    return event.tags.length == 0;
}

async function eventType(
    ctx: NostrAccountContext,
    event: NostrEvent<NostrKind.Group_Message>,
): Promise<GM_Types | Error> {
    if (isCreation(event)) {
        return "gm_creation";
    }

    const receiver = getTags(event).p[0];
    if (receiver == ctx.publicKey.hex) {
        return "gm_invitation"; // received by me
    }
    return "gm_message";
}

export class GroupChatSyncer {
    readonly groupAddrSet = new Set<string>();
    private readonly lock = semaphore(1);

    constructor(
        private readonly database: Database_Contextual_View,
        private readonly pool: ConnectionPool,
    ) {
    }

    async add(...groupAddresses: string[]) {
        const size = this.groupAddrSet.size;
        for (const groupAddr of groupAddresses) {
            this.groupAddrSet.add(groupAddr);
        }
        if (this.groupAddrSet.size == size) {
            return;
        }
        const resp = await this.lock(async () => {
            await this.pool.closeSub(GroupChatSyncer.name);
            const resp = await this.pool.newSub(GroupChatSyncer.name, {
                "#p": Array.from(this.groupAddrSet),
                kinds: [NostrKind.Group_Message],
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
