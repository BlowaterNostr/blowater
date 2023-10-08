import { z } from "https://esm.sh/zod@3.22.4";
import { ConversationLists } from "./UI/conversation-list.ts";
import { parseJSON } from "./features/profile.ts";
import { prepareEncryptedNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";
import { GroupMessageGetter } from "./UI/app_update.tsx";
import { getTags } from "./nostr.ts";
import { ChatMessage } from "./UI/message.ts";

export type GroupMessage = {
    event: NostrEvent<NostrKind.Group_Message>;
};

export type GroupChatCreation = {
    cipherKey: InMemoryAccountContext;
    groupKey: InMemoryAccountContext;
};

export class GroupChatController implements GroupMessageGetter {
    created_groups = new Map<string, GroupChatCreation>();
    messages = new Map<string, ChatMessage[]>();

    constructor(
        private readonly ctx: NostrAccountContext,
        private readonly conversationLists: ConversationLists,
    ) {}

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
        return groupChatCreation;
    }

    async addEvent(event: NostrEvent<NostrKind.Group_Message>) {
        if (isCreation(event)) {
            return await this.handleCreation(event);
        } else if (isMessage(event)) {
            return await this.handleMessage(event);
        } else {
            console.log(GroupChatController.name, "ignore", event);
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

    async handleMessage(event: NostrEvent<NostrKind.Group_Message>) {
        const groupAddr = getTags(event).p[0];
        const decryptedContent = await this.ctx.decrypt(groupAddr, event.content);
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

                this.conversationLists.addGroupCreation(groupChatCreation);
            } else if (content.type == "gm_message") {
                console.log(content);
            }
        } catch (e) {
            return e as Error;
        }
    }

    getGroupChatCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const invitation = this.created_groups.get(group_addr.bech32());
        if (invitation == undefined) {
            return;
        }
        return invitation.groupKey;
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
        const group = this.created_groups.get(groupAddr.bech32())
        if(group == undefined) {
            return new Error(`You are not the admin of ${groupAddr.bech32()}`)
        }
        // create the invitation event
        const invitation = {
            type: "gm_invitation",
            cipherKey: group.cipherKey.privateKey.bech32
        }
        const event = await prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: invitee,
            kind: NostrKind.Group_Message,
            content: JSON.stringify(invitation),
            tags: [
                ["p", invitee.hex]
            ]
        });
        return event
    }
}

function isCreation(event: NostrEvent<NostrKind.Group_Message>) {
    return event.tags.length == 0;
}

function isMessage(event: NostrEvent<NostrKind.Group_Message>) {
    return event.tags.length != 0;
}
