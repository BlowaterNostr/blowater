import { NostrAccountContext, prepareCustomAppDataEvent } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { AddRelay, CustomAppData, CustomAppData_Event, RemoveRelay } from "../nostr.ts";

const damus = "wss://relay.damus.io";
const nos = "wss://nos.lol";

export const defaultRelays = [
    nos,
    damus,
    "wss://relay.nostr.wirednet.jp",
];

export class RelayConfig {
    // This is a state based CRDT based on Vector Clock
    // see https://www.youtube.com/watch?v=OOlnp2bZVRs
    private readonly relaySet = new Map<string, AddRelay | RemoveRelay>();

    constructor(
        public readonly pool: ConnectionPool,
        public readonly ctx: NostrAccountContext,
    ) {}

    getRelayURLs() {
        const urls = new Set<string>();
        for (const v of this.relaySet.values()) {
            if (v.type == "AddRelay") {
                urls.add(v.url);
            }
        }
        return urls;
    }

    async addEvents(events: CustomAppData_Event[]) {
        for (const event of events) {
            const obj = event.customAppData;
            if (!(obj.type == "AddRelay" || obj.type == "RemoveRelay")) {
                continue;
            }
            const currentValue = this.relaySet.get(obj.url);
            if (currentValue) {
                if (obj.vc) {
                    if (obj.vc > currentValue.vc) {
                        this.relaySet.set(obj.url, obj);
                    } else {
                        continue; // current vector clock is larger
                    }
                } else {
                    continue; // do not handle event without vector clock
                }
            } else {
                if (obj.vc) {
                    this.relaySet.set(obj.url, obj);
                } else {
                    continue; // do not handle event without vector clock
                }
            }
        }
        const s = new Set(this.pool.getRelays().map((r) => r.url));
        // add
        for (const url of this.getRelayURLs()) {
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
            if (this.relaySet.get(url)?.type == "RemoveRelay") {
                console.log("RelayConfig:remove url", url, this.relaySet);
                await this.pool.removeRelay(url);
            }
        }
    }

    async addRelayURL(url: string) {
        const err = await this.pool.addRelayURL(url);
        if (err instanceof Error) {
            return err;
        }
        const value = this.relaySet.get(url);
        const event = await prepareCustomAppDataEvent<CustomAppData>(this.ctx, {
            type: "AddRelay",
            url: url,
            vc: value ? value.vc + 1 : 1,
        });
        if (event instanceof Error) {
            return event;
        }
        return this.pool.sendEvent(event);
    }

    async removeRelay(url: string) {
        await this.pool.removeRelay(url);
        const value = this.relaySet.get(url);
        const event = await prepareCustomAppDataEvent<CustomAppData>(this.ctx, {
            type: "RemoveRelay",
            url: url,
            vc: value ? value.vc + 1 : 1,
        });
        if (event instanceof Error) {
            return event;
        }
        return this.pool.sendEvent(event);
    }
}
