import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { NostrAccountContext, NostrEvent, NostrKind, verifyEvent } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { PinListGetter } from "./conversation-list.tsx";
import { parseJSON } from "../features/profile.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export class OtherConfig implements PinListGetter {
    static Empty(nostrEventPusher: Channel<NostrEvent>) {
        return new OtherConfig(nostrEventPusher);
    }

    static async FromLocalStorage(ctx: NostrAccountContext, eventPusher: Channel<NostrEvent>) {
        const item = localStorage.getItem(`${OtherConfig.name}:${ctx.publicKey.bech32()}`);
        if (item == null) {
            return OtherConfig.Empty(eventPusher);
        }
        const event = parseJSON<NostrEvent>(item);
        if (event instanceof Error) {
            console.error(event);
            return OtherConfig.Empty(eventPusher);
        }
        const ok = await verifyEvent(event);
        if (!ok) {
            return OtherConfig.Empty(eventPusher);
        }
        if (event.kind == NostrKind.Custom_App_Data) {
            const config = await OtherConfig.FromNostrEvent(
                // @ts-ignore
                event,
                ctx,
                eventPusher,
            );
            if (config instanceof Error) {
                return OtherConfig.Empty(eventPusher);
            }
            return config;
        }
        return OtherConfig.Empty(eventPusher);
    }

    private constructor(
        private readonly nostrEventPusher: Channel<NostrEvent>,
    ) {}

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

    static async FromNostrEvent(
        event: NostrEvent<NostrKind.Custom_App_Data>,
        ctx: NostrAccountContext,
        pusher: Channel<NostrEvent>,
    ) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const pinListArray = parseJSON<string[]>(decrypted);
        if (pinListArray instanceof Error) {
            return pinListArray;
        }

        let pinList;
        try {
            pinList = new Set<string>(pinListArray);
        } catch (e) {
            console.error(pinListArray, e);
            pinList = [];
        }

        // pinList.fromHex(decrypted);
        const c = new OtherConfig(pusher);
        // c.pinList.merge(pinList);
        for (const pin of pinList) {
            c.addPin(pin);
        }
        return c;
    }

    private async toNostrEvent(ctx: NostrAccountContext) {
        const event = await prepareEncryptedNostrEvent(ctx, {
            encryptKey: ctx.publicKey,
            content: JSON.stringify(Array.from(this.pinList)),
            kind: NostrKind.Custom_App_Data,
            tags: [],
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
}

// export class AutomergeSet {
//     private set = Automerge.init<{
//         [key: string]: true;
//     }>();

//     add(v: string) {
//         console.log("add", v);
//         this.set = Automerge.change(this.set, "add", (doc) => {
//             doc[v] = true;
//         });
//     }

//     delete(v: string) {
//         this.set = Automerge.change(this.set, "add", (doc) => {
//             delete doc[v];
//         });
//     }

//     merge(other: AutomergeSet) {
//         this.set = Automerge.merge(this.set, other.set);
//     }

//     value() {
//         return new Set(Object.keys(this.set));
//     }

//     toHex() {
//         const bytes = Automerge.save(this.set);
//         return secp256k1.utils.bytesToHex(bytes);
//     }

//     fromHex(hex: string) {
//         const bytes = secp256k1.utils.hexToBytes(hex);
//         const set = Automerge.load(bytes);
//         this.set = Automerge.merge(this.set, set);
//     }
// }
