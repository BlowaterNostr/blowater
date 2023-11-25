import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { NostrAccountContext, NostrEvent, NostrKind, verifyEvent } from "../lib/nostr-ts/nostr.ts";
import { PinListGetter } from "./conversation-list.tsx";
import { parseJSON } from "../features/profile.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PinConversation, UnpinConversation } from "../nostr.ts";

export type NostrEventAdder = {
    addEvent(event: NostrEvent): Promise<undefined | Error>;
};

export class OtherConfig implements PinListGetter, NostrEventAdder {
    static Empty(nostrEventPusher: Channel<NostrEvent>, ctx: NostrAccountContext) {
        return new OtherConfig(nostrEventPusher, ctx);
    }

    static async FromLocalStorage(ctx: NostrAccountContext, eventPusher: Channel<NostrEvent>) {
        const item = localStorage.getItem(`${OtherConfig.name}:${ctx.publicKey.bech32()}`);
        if (item == null) {
            return OtherConfig.Empty(eventPusher, ctx);
        }
        const event = parseJSON<NostrEvent>(item);
        if (event instanceof Error) {
            console.error(event);
            return OtherConfig.Empty(eventPusher, ctx);
        }
        const ok = await verifyEvent(event);
        if (!ok) {
            return OtherConfig.Empty(eventPusher, ctx);
        }
        if (event.kind == NostrKind.Custom_App_Data) {
            const config = await OtherConfig.FromNostrEvent(
                // @ts-ignore
                event,
                ctx,
                eventPusher,
            );
            if (config instanceof Error) {
                return OtherConfig.Empty(eventPusher, ctx);
            }
            return config;
        }
        return OtherConfig.Empty(eventPusher, ctx);
    }

    private constructor(
        private readonly nostrEventPusher: Channel<NostrEvent>,
        private readonly ctx: NostrAccountContext,
    ) {}

    private pinList = new Set<string>(); // set of pubkeys in npub format

    getPinList(): Set<string> {
        return this.pinList;
    }

    async addPin(pubkey: string) {
        if (this.pinList.has(pubkey)) {
            return;
        }
        this.pinList.add(pubkey);
        const err = await this.saveToLocalStorage();
        if (err instanceof Error) {
            return err;
        }
        const event = await prepareEncryptedNostrEvent(this.ctx, {
            content: JSON.stringify({
                type: "PinConversation",
                pubkey: pubkey,
            }),
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Custom_App_Data,
        });
        if (event instanceof Error) {
            return event;
        }
        /* no await */ this.nostrEventPusher.put(event);
    }

    async removePin(pubkey: string) {
        const exist = this.pinList.delete(pubkey);
        if (!exist) {
            return;
        }
        const event = await prepareEncryptedNostrEvent(this.ctx, {
            content: JSON.stringify({
                type: "UnpinConversation",
                pubkey: pubkey,
            }),
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Custom_App_Data,
        });
        if (event instanceof Error) {
            return event;
        }
        /* no await */ this.nostrEventPusher.put(event);
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

        const c = new OtherConfig(pusher, ctx);
        for (const pin of pinList) {
            const err = await c.addPin(pin);
            if (err instanceof Error) {
                return err;
            }
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

    private async saveToLocalStorage() {
        const event = await this.toNostrEvent(this.ctx);
        if (event instanceof Error) {
            return event;
        }
        localStorage.setItem(`${OtherConfig.name}:${this.ctx.publicKey.bech32()}`, JSON.stringify(event));
    }

    async addEvent(event: NostrEvent) {
        if (event.kind != NostrKind.Custom_App_Data) {
            return;
        }
        const decrypted = await this.ctx.decrypt(this.ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const pin = parseJSON<ConfigEvent>(decrypted);
        if (pin instanceof Error) {
            return pin;
        }

        if (pin.type == "PinConversation" || pin.type == "UnpinConversation") {
            if (pin.type == "PinConversation") {
                if (this.pinList.has(pin.pubkey)) {
                    return;
                }
                this.pinList.add(pin.pubkey);
            } else {
                this.pinList.delete(pin.pubkey);
            }
            const err = await this.saveToLocalStorage();
            if (err instanceof Error) {
                return err;
            }
        }
    }
}

export type ConfigEvent = PinConversation | UnpinConversation;
