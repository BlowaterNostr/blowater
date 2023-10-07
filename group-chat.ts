import { z } from "https://esm.sh/zod@3.22.4";
import { ConversationLists } from "./UI/conversation-list.ts";
import { parseJSON } from "./features/profile.ts";
import { prepareEncryptedNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";
import { GroupMessageGetter } from "./UI/app_update.tsx";
import { getTags } from "./nostr.ts";

export type GroupMessage = {
    event: NostrEvent<NostrKind.Group_Message>;
};

export type GroupChatCreation = {
    cipherKey: InMemoryAccountContext;
    groupKey: InMemoryAccountContext;
};

export class GroupChatController implements GroupMessageGetter {
    created_groups = new Map<string, GroupChatCreation>();

    constructor(
        private readonly ctx: NostrAccountContext,
        private readonly conversationLists: ConversationLists,
    ) {}

    getGroupMessages(publicKey: string): GroupMessage[] {
        return []   // todo
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
        let decryptionPubkey = event.pubkey;
        if(getTags(event).p.length > 0 && getTags(event).p[0]) {
            decryptionPubkey = getTags(event).p[0]
        }
        const decryptedContent = await this.ctx.decrypt(decryptionPubkey, event.content);
        if (decryptedContent instanceof Error) {
            return decryptedContent;
        }
        console.log(decryptedContent)

        const json = parseJSON<unknown>(decryptedContent);
        if (json instanceof Error) {
            return json;
        }

        try {
            const schema = z.object({
                type: z.string(),
            });
            const content = schema.parse(json);
            if(content.type == "gm_creation") {
                const schema = z.object({
                    type: z.string(),
                    cipherKey: z.string(),
                    groupKey: z.string()
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
                console.log(content)
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
}
