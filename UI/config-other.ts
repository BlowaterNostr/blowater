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
                console.error(pubkey);
                continue;
            }
            c.pinList.add(pin);
        }
        return c;
    }

    toNostrEvent() {
    }
}
