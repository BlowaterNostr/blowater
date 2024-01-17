import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent } from "../../libs/nostr.ts/event.ts";
import { NostrAccountContext, NostrEvent, NostrKind, verifyEvent } from "../../libs/nostr.ts/nostr.ts";
import { parseJSON } from "../features/profile.ts";
import { PinConversationRelay, UnpinConversationRelay } from "../nostr.ts";
import { LamportTime } from "../time.ts";
import { PinListGetter } from "./conversation-list.tsx";

export type NostrEventAdder = {
    addEvent(event: NostrEvent): Promise<undefined | Error>;
};

export class OtherConfig implements PinListGetter, NostrEventAdder {
    static Empty(nostrEventPusher: Channel<NostrEvent>, ctx: NostrAccountContext, lamport: LamportTime) {
        return new OtherConfig(nostrEventPusher, ctx, lamport);
    }

    static async FromLocalStorage(
        ctx: NostrAccountContext,
        eventPusher: Channel<NostrEvent>,
        lamport: LamportTime,
    ) {
        const item = localStorage.getItem(`${OtherConfig.name}:${ctx.publicKey.bech32()}`);
        if (item == null) {
            return OtherConfig.Empty(eventPusher, ctx, lamport);
        }
        const event = parseJSON<NostrEvent>(item);
        if (event instanceof Error) {
            console.error(event);
            return OtherConfig.Empty(eventPusher, ctx, lamport);
        }
        const ok = await verifyEvent(event);
        if (!ok) {
            return OtherConfig.Empty(eventPusher, ctx, lamport);
        }
        if (event.kind == NostrKind.Encrypted_Custom_App_Data) {
            const config = await OtherConfig.FromNostrEvent(
                {
                    ...event,
                    kind: event.kind,
                },
                ctx,
                eventPusher,
                lamport,
            );
            if (config instanceof Error) {
                return OtherConfig.Empty(eventPusher, ctx, lamport);
            }
            return config;
        }
        return OtherConfig.Empty(eventPusher, ctx, lamport);
    }

    private constructor(
        private readonly nostrEventPusher: Channel<NostrEvent>,
        private readonly ctx: NostrAccountContext,
        private readonly lamport: LamportTime,
    ) {}

    private pinList = new Map<string, PinConversationRelay | UnpinConversationRelay>(); // set of pubkeys in npub format

    getPinList(): Set<string> {
        const set = new Set<string>();
        for (const event of this.pinList.values()) {
            if (event.type == "PinConversation") {
                set.add(event.pubkey);
            }
        }
        return set;
    }

    async addPin(pubkey: string) {
        const currentPin = this.pinList.get(pubkey);
        if (currentPin && currentPin.type == "PinConversation") {
            return;
        }

        const pin: PinConversationRelay = {
            pubkey,
            type: "PinConversation",
            lamport: this.lamport.now(),
        };

        const event = await prepareEncryptedNostrEvent(this.ctx, {
            content: JSON.stringify(pin),
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Encrypted_Custom_App_Data,
        });
        if (event instanceof Error) {
            return event;
        }
        this.pinList.set(pubkey, pin);
        const err = await this.saveToLocalStorage();
        if (err instanceof Error) {
            return err;
        }
        /* no await */ this.nostrEventPusher.put(event);
    }

    async removePin(pubkey: string) {
        const exist = this.pinList.delete(pubkey);
        if (!exist) {
            return;
        }

        const unpin: UnpinConversationRelay = {
            pubkey,
            type: "UnpinConversation",
            lamport: this.lamport.now(),
        };
        const event = await prepareEncryptedNostrEvent(this.ctx, {
            content: JSON.stringify(unpin),
            encryptKey: this.ctx.publicKey,
            kind: NostrKind.Encrypted_Custom_App_Data,
        });
        if (event instanceof Error) {
            return event;
        }
        this.pinList.set(pubkey, unpin);
        const err = await this.saveToLocalStorage();
        if (err instanceof Error) {
            return err;
        }
        /* no await */ this.nostrEventPusher.put(event);
    }

    static async FromNostrEvent(
        event: NostrEvent<NostrKind.Encrypted_Custom_App_Data>,
        ctx: NostrAccountContext,
        pusher: Channel<NostrEvent>,
        lamport: LamportTime,
    ) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content, "nip4");
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

        const c = new OtherConfig(pusher, ctx, lamport);
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
            content: JSON.stringify(Array.from(this.getPinList())),
            kind: NostrKind.Encrypted_Custom_App_Data,
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
        if (event.kind != NostrKind.Encrypted_Custom_App_Data) {
            return;
        }
        const decrypted = await this.ctx.decrypt(this.ctx.publicKey.hex, event.content, "nip44");
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const pin = parseJSON<ConfigEvent>(decrypted);
        if (pin instanceof Error) {
            return pin;
        }

        if (pin.type == "PinConversation" || pin.type == "UnpinConversation") {
            const currentEvent = this.pinList.get(pin.pubkey);

            if (currentEvent && pin.lamport < currentEvent.lamport) {
                return; // ignore because the current event is newer
            }

            this.lamport.set(pin.lamport);
            this.pinList.set(pin.pubkey, pin);

            const err = await this.saveToLocalStorage();
            if (err instanceof Error) {
                return err;
            }
        }
    }
}

export type ConfigEvent = PinConversationRelay | UnpinConversationRelay;
