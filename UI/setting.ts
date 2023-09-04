import * as Automerge from "https://deno.land/x/automerge@2.1.0-alpha.12/index.ts";
import {
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    prepareCustomAppDataEvent,
} from "../lib/nostr-ts/nostr.ts";
import * as secp256k1 from "../lib/nostr-ts/vendor/secp256k1.js";
import { ConnectionPool, RelayAlreadyRegistered } from "../lib/nostr-ts/relay.ts";

export const defaultRelays = [
    "wss://nos.lol",
    "wss://relay.damus.io",
    "wss://relay.nostr.wirednet.jp",
];

type Config = {
    [key: string]: boolean;
};

export class RelayConfig {
    // This is a state based CRDT based on Vector Clock
    // see https://www.youtube.com/watch?v=OOlnp2bZVRs
    private config: Automerge.next.Doc<Config> = Automerge.init();

    static async FromNostrEvent(event: NostrEvent<NostrKind.CustomAppData>, ctx: NostrAccountContext) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const json = JSON.parse(decrypted);
        const relayConfig = new RelayConfig();
        relayConfig.merge(secp256k1.utils.hexToBytes(json.data));
        return relayConfig;
    }

    async toNostrEvent(ctx: NostrAccountContext, needEncryption: boolean) {
        if (needEncryption) {
            const hex = secp256k1.utils.bytesToHex(this.save());
            const event = await prepareCustomAppDataEvent(ctx, {
                type: "relayConfig",
                data: hex,
            });
            return event;
        }
        throw "not implemented";
        // prepareNormalNostrEvent(ctx, NostrKind.)
    }

    getRelayURLs() {
        return new Set(Object.keys(this.config));
    }

    save() {
        return Automerge.save(this.config);
    }

    merge(bytes: Uint8Array) {
        const otherDoc = Automerge.load<Config>(bytes);
        this.config = Automerge.merge(this.config, otherDoc);
    }

    async add(url: string) {
        if (this.config[url] != undefined) {
            return;
        }
        if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
            url = "wss://" + url;
        }
        this.config = Automerge.change(this.config, "add", (config) => {
            config[url] = true;
        });
        const hex = secp256k1.utils.bytesToHex(this.save());
        // localStorage.setItem(RelayConfig.name, hex);
    }

    async remove(url: string) {
        this.config = Automerge.change(this.config, "remove", (config) => {
            delete config[url];
        });
    }

    async syncWithPool(pool: ConnectionPool) {
        const errors = [];
        for (const url of Object.keys(this.config)) {
            const err = await pool.addRelayURL(url);
            if (err instanceof RelayAlreadyRegistered) {
                continue;
            } else if (err instanceof Error) {
                errors.push(err);
            }
        }
        for (const r of pool.getRelays()) {
            if (this.config[r.url] == undefined) {
                await pool.removeRelay(r.url);
            }
        }
        if (errors.length > 0) {
            return errors;
        }
    }
}

export function applyPoolToRelayConfig(pool: ConnectionPool, relayConfig: RelayConfig) {
    for (const relay of pool.getRelays()) {
        relayConfig.add(relay.url);
    }
}
