import { prepareParameterizedEvent } from "../lib/nostr-ts/event.ts";
import { NostrAccountContext, NostrEvent, NostrKind, verifyEvent } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { PinListGetter } from "./conversation-list.tsx";
import * as secp256k1 from "../lib/nostr-ts/vendor/secp256k1.js";
import { parseJSON } from "../features/profile.ts";

export class OtherConfig implements PinListGetter {
    static Empty() {
        return new OtherConfig();
    }

    static async FromLocalStorage(ctx: NostrAccountContext) {
        const item = localStorage.getItem(`${OtherConfig.name}:${ctx.publicKey.bech32()}`);
        if (item == null) {
            return OtherConfig.Empty();
        }
        const event = parseJSON<NostrEvent>(item);
        if (event instanceof Error) {
            console.error(event);
            return OtherConfig.Empty();
        }
        const ok = await verifyEvent(event);
        if (!ok) {
            return OtherConfig.Empty();
        }
        if (event.kind == NostrKind.Custom_App_Data) {
            const config = await OtherConfig.FromNostrEvent(
                // @ts-ignore
                event,
                ctx,
            );
            if (config instanceof Error) {
                return OtherConfig.Empty();
            }
            return config;
        }
        return OtherConfig.Empty();
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
        const c = new OtherConfig();
        return c;
    }

    async toNostrEvent(ctx: NostrAccountContext) {
        const encryptedContent = await ctx.encrypt(
            ctx.publicKey.hex,
            ctx.publicKey.hex,
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

    async saveToLocalStorage(ctx: NostrAccountContext) {
        const event = await this.toNostrEvent(ctx);
        if (event instanceof Error) {
            return event;
        }
        localStorage.setItem(`${OtherConfig.name}:${ctx.publicKey.bech32()}`, JSON.stringify(event));
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
            const config = await OtherConfig.FromNostrEvent(
                // @ts-ignore
                msg.res.event,
                ctx,
            );
            if (config instanceof Error) {
                console.error(config);
                continue;
            }
        }
    }
}
