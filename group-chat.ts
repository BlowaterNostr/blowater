import { prepareParameterizedEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey, PublicKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "./lib/nostr-ts/nostr.ts";

class GroupChatController {
    created_groups = new Map<string, {
        cipher_key: PrivateKey;
        group_key: PrivateKey;
    }>();

    invitations = new Map<string, {
        cipher_key: PrivateKey;
        group_addr: PublicKey;
    }>();

    constructor(
        private readonly ctx: NostrAccountContext,
    ) {}

    async encodeCreationsToNostrEvent() {
        const creationArray = Array.from(this.created_groups.values())
        const content = await this.ctx.encrypt(this.ctx.publicKey.hex, JSON.stringify(creationArray))
        if(content instanceof Error) {
            return content
        }
        const event = await prepareParameterizedEvent(this.ctx, {
            content,
            d: GroupChatController.name,
            kind: NostrKind.Custom_App_Data,
        });
        return event
    }

    addEvents(...events: NostrEvent[]) {
        for (const event of events) {
            if(event.kind != NostrKind.Custom_App_Data) {
                continue
            }
            // @ts-ignore
            this.addEvent(event)
        }
    }

    addEvent(event: NostrEvent<NostrKind.Custom_App_Data>) {

    }

    getGroupChatCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const invitation = this.invitations.get(group_addr.hex)
        if(invitation == undefined) {
            return
        }
        return InMemoryAccountContext.New(invitation.cipher_key)
    }

    getGroupAdminCtx(group_addr: PublicKey): InMemoryAccountContext | undefined {
        const invitation = this.created_groups.get(group_addr.hex)
        if(invitation == undefined) {
            return
        }
        return InMemoryAccountContext.New(invitation.group_key)
    }
}
