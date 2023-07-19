import {
    NostrAccountContext,
    prepareCustomAppDataEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { CustomAppData } from "../nostr.ts";

const damus = "wss://relay.damus.io";
const nos = "wss://nos.lol";

export const defaultRelays = [
    nos,
    damus,
    "wss://relay.nostr.wirednet.jp",
];

export class RelayConfig {
    private readonly relaySet = new Set<string>();

    constructor(
        public readonly pool: ConnectionPool,
        public readonly ctx: NostrAccountContext,
    ) {}

    getRelayURLs(): string[] {
        const urls = this.pool.getRelays().map((r) => r.url);
        if (urls.length == 0) {
            return defaultRelays;
        }
        return urls;
    }

    async addEvents(events: { customAppData: CustomAppData }[]) {
        for (const event of events) {
            const obj = event.customAppData;
            if (obj.type == "AddRelay") {
                this.relaySet.add(obj.url);
            } else if (obj.type == "RemoveRelay") {
                this.relaySet.delete(obj.url);
            }
        }
        const s = new Set(this.pool.getRelays().map((r) => r.url));
        // add
        for (const url of this.relaySet) {
            if (!s.has(url)) {
                const err = await this.pool.addRelayURL(url);
                if (err instanceof Error) {
                    console.error(err);
                    continue;
                }
            }
        }
        // remove
        for (const url of s) {
            if (!this.relaySet.has(url)) {
                this.pool.removeRelay(url);
            }
        }
    }

    async addRelayURL(url: string) {
        const err = await this.pool.addRelayURL(url);
        if (err instanceof Error) {
            return err;
        }
        const event = await prepareCustomAppDataEvent<CustomAppData>(this.ctx, {
            type: "AddRelay",
            url: url,
        });
        if (event instanceof Error) {
            return event;
        }
        return this.pool.sendEvent(event);
    }

    async removeRelay(url: string) {
        await this.pool.removeRelay(url);
        const event = await prepareCustomAppDataEvent<CustomAppData>(this.ctx, {
            type: "RemoveRelay",
            url: url,
        });
        if (event instanceof Error) {
            return event;
        }
        return this.pool.sendEvent(event);
    }
}
