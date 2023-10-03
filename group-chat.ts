import { ConversationLists } from "./UI/conversation-list.ts";
import { prepareEncryptedNostrEvent, prepareParameterizedEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";

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
        const content = await this.ctx.encrypt(this.ctx.publicKey.hex, JSON.stringify(groupChatCreation));
        if (content instanceof Error) {
            return content;
        }
        const event = prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: groupChatCreation.groupKey.toPublicKey(),
            kind: NostrKind.Group_Creation,
            tags: [],
            content: content,
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

    // addEvent(event: NostrEvent) {
    //     console.log("add event");
    // }

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
