import { ConversationLists } from "./UI/conversation-list.ts";
import { prepareEncryptedNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";

export type GroupChatCreation = {
    cipherKey: InMemoryAccountContext;
    groupKey: InMemoryAccountContext;
};

export class GroupChatController {
    created_groups = new Map<string, GroupChatCreation>();

    constructor(
        private readonly ctx: NostrAccountContext,
        private readonly conversationLists: ConversationLists,
    ) {}

    async encodeCreationToNostrEvent(groupCreation: GroupChatCreation) {
        const event = prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Group_Message,
            tags: [],
            content: JSON.stringify({
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
        try {
            const decryptedContent = await this.ctx.decrypt(event.pubkey, event.content);
            if (decryptedContent instanceof Error) {
                console.error(decryptedContent);
                return;
            }
            const content = JSON.parse(decryptedContent);
            if (content.length == 0) {
                return;
            }
            const groupKey = PrivateKey.FromHex(content.groupKey);
            if (groupKey instanceof Error) {
                return groupKey;
            }
            const cipherKey = PrivateKey.FromHex(content.cipherKey);
            if (cipherKey instanceof Error) {
                return cipherKey;
            }

            const groupChatCreation = {
                groupKey: InMemoryAccountContext.New(groupKey),
                cipherKey: InMemoryAccountContext.New(cipherKey),
            };
            this.created_groups.set(groupKey.toPublicKey().bech32(), groupChatCreation);

            this.conversationLists.addGroupCreation(groupChatCreation);
        } catch (e) {
            return e; // do nothing
        }
    }

    // getGroupChatCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
    //     const invitation = this.invitations.get(group_addr.hex);
    //     if (invitation == undefined) {
    //         return;
    //     }
    //     return InMemoryAccountContext.New(invitation.cipher_key);
    // }

    getGroupAdminCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const creation = this.created_groups.get(group_addr.bech32());
        if (!creation) {
            return;
        }
        return creation.groupKey;
    }
}
