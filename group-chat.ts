import { ConversationLists } from "./UI/conversation-list.ts";
import { prepareParameterizedEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";

export type GroupChatCreation = {
    cipherKey: PrivateKey;
    groupKey: PrivateKey;
};

export class GroupChatController {
    created_groups = new Map<string, GroupChatCreation>();

    invitations = new Map<string, {
        cipher_key: PrivateKey;
        group_addr: PublicKey;
    }>();

    constructor(
        private readonly ctx: NostrAccountContext,
        private readonly conversationLists: ConversationLists,
    ) {}

    async encodeCreationsToNostrEvent() {
        const creationArray = Array.from(this.created_groups.values());
        const content = await this.ctx.encrypt(this.ctx.publicKey.hex, JSON.stringify(creationArray));
        if (content instanceof Error) {
            return content;
        }
        const event = await prepareParameterizedEvent(this.ctx, {
            content,
            d: GroupChatController.name,
            kind: NostrKind.Custom_App_Data,
        });
        return event;
    }

    createGroupChat(args: GroupChatCreation) {
        if (this.created_groups.has(args.groupKey.bech32)) {
            return new Error("to do: change text");
        }
        this.created_groups.set(args.groupKey.bech32, args);
        this.conversationLists.groupChatSummaries.set(args.groupKey.bech32, {
            newestEventReceivedByMe: undefined,
            newestEventSendByMe: undefined,
            profile: undefined,
            pubkey: args.groupKey.toPublicKey(),
        });
        return InMemoryAccountContext.New(args.groupKey);
    }

    addEvents(...events: NostrEvent<NostrKind.Custom_App_Data>[]) {
        for (const event of events) {
            if (event.kind != NostrKind.Custom_App_Data) {
                continue;
            }
            // @ts-ignore
            this.addEvent(event);
        }
    }

    addEvent(event: NostrEvent<NostrKind.Custom_App_Data>) {
        this.conversationLists.addEvents([event]);
    }

    getGroupChatCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const invitation = this.invitations.get(group_addr.hex);
        if (invitation == undefined) {
            return;
        }
        return InMemoryAccountContext.New(invitation.cipher_key);
    }

    getGroupAdminCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const creations = this.created_groups.get(group_addr.hex);
        if (creations == undefined) {
            return;
        }
        return InMemoryAccountContext.New(creations.groupKey);
    }
}
