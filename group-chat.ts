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
        private readonly conversationLists: ConversationLists,
    ) {}

    async encodeCreationsToNostrEvent(ctx: InMemoryAccountContext) {
        const groupChatCreation = this.created_groups.get(ctx.privateKey.hex);
        const event = prepareEncryptedNostrEvent(this.ctx, {
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Group_Creation,
            tags: [],
            content: JSON.stringify(groupChatCreation),
        });
        return event;
    }

    createGroupChat() {
        const groupChatCreation: GroupChatCreation = {
            cipherKey: PrivateKey.Generate(),
            groupKey: PrivateKey.Generate(),
        };
        this.created_groups.set(groupChatCreation.groupKey.hex, groupChatCreation);
        return InMemoryAccountContext.New(groupChatCreation.groupKey);
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
        this.conversationLists.addEvents([event]);
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
