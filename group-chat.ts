import { ConversationLists } from "./UI/conversation-list.ts";
import { prepareEncryptedNostrEvent, prepareParameterizedEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";
import { getTags } from "./nostr.ts";

export type GroupChatCreation = {
    cipherKey: PrivateKey;
    groupKey: PrivateKey;
};

export class GroupChatController {
    created_groups = new Map<string, GroupChatCreation>();

    // invitations = new Map<string, {
    //     cipher_key: PrivateKey;
    //     group_addr: PublicKey;
    // }>();

    constructor(
        private readonly ctx: NostrAccountContext,
    ) {}

    async encodeCreationsToNostrEvent(groupChatCreation: GroupChatCreation) {
        const event = prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Group_Creation,
            tags: [
                ["d", GroupChatController.name],
            ],
            content: JSON.stringify(groupChatCreation),
        });
        return event;
    }

    createGroupChat() {
        const groupChatCreation: GroupChatCreation = {
            cipherKey: PrivateKey.Generate(),
            groupKey: PrivateKey.Generate(),
        };
        const pubkey = groupChatCreation.groupKey.toPublicKey().hex;
        this.created_groups.set(pubkey, groupChatCreation);
        return groupChatCreation;
    }

    // addEvents(...events: NostrEvent[]) {
    //     for (const event of events) {
    //         if (event.kind != NostrKind.Custom_App_Data) {
    //             continue;
    //         }
    //         // @ts-ignore
    //         this.addEvent(event);
    //     }
    // }

    async addEvent(event: NostrEvent<NostrKind.Group_Creation>) {
        const d = getTags(event).d;
        if (d && d == GroupChatController.name) {
            try {
                const decryptedContent = await this.ctx.decrypt(event.pubkey, event.content);
                if (decryptedContent instanceof Error) {
                    return;
                }
                const content = JSON.parse(decryptedContent);
                if (content.length == 0) {
                    return;
                }
                const groupKey = PrivateKey.FromHex(content.groupKey.hex);
                const cipherKey = PrivateKey.FromHex(content.cipherKey.hex);
                if (groupKey instanceof Error || cipherKey instanceof Error) {
                    return;
                }

                this.created_groups.set(groupKey.toPublicKey().hex, {
                    groupKey: groupKey,
                    cipherKey: cipherKey,
                });
            } catch (e) {
                // do no thing
            }
        }
    }

    // getGroupChatCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
    //     const invitation = this.invitations.get(group_addr.hex);
    //     if (invitation == undefined) {
    //         return;
    //     }
    //     return InMemoryAccountContext.New(invitation.cipher_key);
    // }

    // getGroupAdminCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
    //     const creations = this.created_groups.get(group_addr.hex);
    //     if (creations == undefined) {
    //         return;
    //     }
    //     return InMemoryAccountContext.New(creations.groupKey);
    // }
}
