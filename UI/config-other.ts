import { prepareParameterizedEvent } from "../lib/nostr-ts/event.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";

export class OtherConfig {
    static Empty() {
        return new OtherConfig();
    }

    readonly pinList = new Set<string>(); // set of pubkeys in npub format

    static async FromNostrEvent(event: NostrEvent<NostrKind.Custom_App_Data>, ctx: NostrAccountContext) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const pinList = JSON.parse(decrypted);
        const c = new OtherConfig();
        for (const pin of pinList) {
            const pubkey = PublicKey.FromBech32(pin);
            if (pubkey instanceof Error) {
                continue;
            }
            c.pinList.add(pubkey.bech32());
        }
        return c;
    }

    async toNostrEvent(ctx: NostrAccountContext) {
        const encryptedContent = await ctx.encrypt(
            ctx.publicKey.hex,
            JSON.stringify(Array.from(this.pinList)),
        );
        if (encryptedContent instanceof Error) {
            return encryptedContent;
        }
        const event = await prepareParameterizedEvent(ctx, {
            content: encryptedContent,
            d: OtherConfig.name,
            kind: NostrKind.Custom_App_Data,
            created_at: Date.now() / 1000,
        });
        return event;
    }
}
