import * as Automerge from "https://deno.land/x/automerge@2.1.0-alpha.12/index.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import * as secp256k1 from "../lib/nostr-ts/vendor/secp256k1.js";
import { ConnectionPool, RelayAlreadyRegistered } from "../lib/nostr-ts/relay-pool.ts";
import { prepareParameterizedEvent } from "../lib/nostr-ts/event.ts";
import { parseJSON } from "../features/profile.ts";

export const defaultRelays = [
    "wss://relay.blowater.app",
    "wss://nos.lol",
    "wss://relay.damus.io",
    "wss://relay.nostr.wirednet.jp",
];

type Config = {
    [key: string]: boolean;
};

export interface RelayAdder {
    addRelayURL(url: string): Promise<RelayAlreadyRegistered | Error | void>;
}

export class RelayConfig {
    // This is a state based CRDT based on Vector Clock
    // see https://www.youtube.com/watch?v=OOlnp2bZVRs
    private config: Automerge.next.Doc<Config> = Automerge.init();
    private constructor(
        private readonly relayAdder: RelayAdder,
    ) {}

    static Empty(relayAdder: RelayAdder) {
        return new RelayConfig(relayAdder);
    }

    // The the relay config of this account from local storage
    static FromLocalStorage(ctx: NostrAccountContext, relayAdder: RelayAdder) {
        const encodedConfigStr = localStorage.getItem(this.localStorageKey(ctx));
        if (encodedConfigStr == null) {
            return RelayConfig.Empty(relayAdder);
        }
        const config = Automerge.load<Config>(secp256k1.utils.hexToBytes(encodedConfigStr));
        const relayConfig = new RelayConfig(relayAdder);
        relayConfig.config = config;
        for (const url of relayConfig.getRelayURLs()) {
            relayConfig.relayAdder.addRelayURL(url).then((res) => {
                if (res instanceof Error) {
                    console.error(res); // todo: pipe to global error toast
                }
            });
        }
        return relayConfig;
    }
    static localStorageKey(ctx: NostrAccountContext) {
        return `${RelayConfig.name}-${ctx.publicKey.bech32()}`;
    }

    /////////////////////////////
    // Nostr Encoding Decoding //
    /////////////////////////////
    static async FromNostrEvent(event: NostrEvent, ctx: NostrAccountContext, relayAdder: RelayAdder) {
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }

        const json = parseJSON<{
            data: Config;
        }>(decrypted);
        if (json instanceof Error) {
            return json;
        }
        const relayConfig = new RelayConfig(relayAdder);
        console.log(json.data);
        relayConfig.merge(secp256k1.utils.hexToBytes(json.data));
        return relayConfig;
    }

    async toNostrEvent(ctx: NostrAccountContext) {
        const configJSON = JSON.stringify({
            type: RelayConfig.name,
            data: this.saveAsHex(),
        });
        const encrypted = await ctx.encrypt(ctx.publicKey.hex, configJSON);
        if (encrypted instanceof Error) {
            return encrypted;
        }
        const event = await prepareParameterizedEvent(ctx, {
            content: encrypted,
            d: RelayConfig.name,
            kind: NostrKind.Custom_App_Data,
        });
        return event;
    }

    getRelayURLs() {
        return new Set(Object.keys(this.config));
    }

    save() {
        return Automerge.save(this.config);
    }
    private saveAsHex() {
        const bytes = this.save();
        return secp256k1.utils.bytesToHex(bytes);
    }
    saveToLocalStorage(ctx: NostrAccountContext) {
        const hex = this.saveAsHex();
        localStorage.setItem(RelayConfig.localStorageKey(ctx), hex);
    }

    merge(bytes: Uint8Array) {
        const otherDoc = Automerge.load<Config>(bytes);
        console.log(otherDoc);
        this.config = Automerge.merge(this.config, otherDoc);
        for (const url of this.getRelayURLs()) {
            this.relayAdder.addRelayURL(url).then((res) => {
                if (res instanceof Error) {
                    console.error(res); // todo: pipe to global error toast
                }
            });
        }
    }

    async add(url: string): Promise<Error | void> {
        console.log("add relay config", url);
        const err = await this.relayAdder.addRelayURL(url);
        if (err instanceof Error && !(err instanceof RelayAlreadyRegistered)) {
            return err;
        }
        if (this.config[url] != undefined) {
            return;
        }
        if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
            url = "wss://" + url;
        }
        this.config = Automerge.change(this.config, "add", (config) => {
            config[url] = true;
        });
    }

    async remove(url: string) {
        this.config = Automerge.change(this.config, "remove", (config) => {
            delete config[url];
        });
    }
}

export function applyPoolToRelayConfig(pool: ConnectionPool, relayConfig: RelayConfig) {
    for (const relay of pool.getRelays()) {
        relayConfig.add(relay.url);
    }
}
