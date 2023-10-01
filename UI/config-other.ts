import { prepareParameterizedEvent } from "../lib/nostr-ts/event.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { PinListGetter } from "./conversation-list.tsx";

export class OtherConfig implements PinListGetter {
    static Empty() {
        return new OtherConfig();
    }

    private pinList = new Set<string>(); // set of pubkeys in npub format
    getPinList(): Set<string> {
        return this.pinList;
    }

    addPin(pubkey: string) {
        this.pinList.add(pubkey);
    }

    removePin(pubkey: string) {
        this.pinList.delete(pubkey);
    }

    static async FromNostrEvent(event: NostrEvent<NostrKind.Custom_App_Data>, ctx: NostrAccountContext) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const pinList = JSON.parse(decrypted);
        const c = new OtherConfig();
        for (const pin of pinList) {
            const pubkey = PublicKey.FromString(pin);
            if (pubkey instanceof Error) {
                continue;
            }
            c.pinList.add(pubkey.hex);
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
        });
        return event;
    }

    async saveToRelay(pool: ConnectionPool, ctx: NostrAccountContext) {
        const nostrEvent = await this.toNostrEvent(ctx);
        if (nostrEvent instanceof Error) {
            return nostrEvent;
        }
        const err = pool.sendEvent(nostrEvent);
        if (err instanceof Error) {
            return err;
        }
    }

    async syncFromRelay(pool: ConnectionPool, ctx: NostrAccountContext) {
        const stream = await pool.newSub(OtherConfig.name, {
            "#d": [OtherConfig.name],
            authors: [ctx.publicKey.hex],
            kinds: [NostrKind.Custom_App_Data],
        });
        if (stream instanceof Error) {
            throw stream; // impossible
        }
        for await (const msg of stream.chan) {
            if (msg.res.type == "EOSE") {
                continue;
            }
            console.log("pin list", msg);
            const config = await OtherConfig.FromNostrEvent(
                // @ts-ignore
                msg.res.event,
                ctx,
            );
            if (config instanceof Error) {
                console.error(config);
                continue;
            }
            this.pinList = config.pinList;
            console.log(this.pinList);
        }
    }
}
