import { NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool, RelayAdder, RelayGetter, RelayRemover } from "../lib/nostr-ts/relay-pool.ts";
import { parseJSON } from "../features/profile.ts";
import { SingleRelayConnection } from "../lib/nostr-ts/relay-single.ts";

export const defaultRelays = [
    "wss://relay.blowater.app",
    "wss://nos.lol",
    "wss://relay.damus.io",
    "wss://relay.nostr.wirednet.jp",
];

export class RelayConfig {
    private config = new Set();
    private constructor(
        private readonly relayPool: RelayAdder & RelayRemover & RelayGetter,
    ) {}

    static Empty(relayPool: RelayAdder & RelayRemover & RelayGetter) {
        return new RelayConfig(relayPool);
    }

    // The the relay config of this account from local storage
    static async FromLocalStorage(
        ctx: NostrAccountContext,
        relayAdder: RelayAdder & RelayRemover & RelayGetter,
    ) {
        const encodedConfigStr = localStorage.getItem(this.localStorageKey(ctx));
        if (encodedConfigStr == null) {
            return RelayConfig.Empty(relayAdder);
        }
        let relayArray = parseJSON<string[]>(encodedConfigStr);
        if (relayArray instanceof Error) {
            console.log(relayArray.message);
            relayArray = [];
        }
        const relayConfig = new RelayConfig(relayAdder);
        for (const relay of relayArray) {
            relayConfig.add(relay);
        }
        return relayConfig;
    }
    static localStorageKey(ctx: NostrAccountContext) {
        return `${RelayConfig.name}-${ctx.publicKey.bech32()}`;
    }

    /////////////////////////////
    // Nostr Encoding Decoding //
    /////////////////////////////
    // static async FromNostrEvent(
    //     event: NostrEvent,
    //     ctx: NostrAccountContext,
    //     relayAdder: RelayAdder & RelayRemover,
    // ) {
    //     const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
    //     if (decrypted instanceof Error) {
    //         return decrypted;
    //     }

    //     const json = parseJSON<{
    //         data: Config;
    //     }>(decrypted);
    //     if (json instanceof Error) {
    //         return json;
    //     }
    //     const relayConfig = new RelayConfig(relayAdder);
    //     console.log(json);
    //     return relayConfig;
    // }

    getRelayURLs() {
        return new Set(Object.keys(this.config));
    }

    saveToLocalStorage(ctx: NostrAccountContext) {
        localStorage.setItem(RelayConfig.localStorageKey(ctx), JSON.stringify(Array.from(this.config)));
    }

    async add(url: string): Promise<Error | SingleRelayConnection> {
        console.log("add relay config", url);
        const relay = await this.relayPool.addRelayURL(url);
        if (relay instanceof Error) {
            return relay;
        }
        this.config.add(url);
        return relay;
    }

    async remove(url: string) {
        this.relayPool.removeRelay(url);
        return this.config.delete(url);
    }
}

export function applyPoolToRelayConfig(pool: ConnectionPool, relayConfig: RelayConfig) {
    for (const relay of pool.getRelays()) {
        relayConfig.add(relay.url);
    }
}
