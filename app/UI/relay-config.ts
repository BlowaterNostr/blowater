import { ConnectionPool, newURL, NostrAccountContext, SingleRelayConnection } from "@blowater/nostr-sdk";
import { parseJSON } from "../features/profile.ts";
import { url_identity } from "./_helper.ts";

export const default_blowater_relay = new URL("wss://blowater.nostr1.com");

export class RelayConfig {
    private readonly ctx: NostrAccountContext;
    private readonly relayPool: ConnectionPool;

    private constructor(
        args: {
            ctx: NostrAccountContext;
            relayPool: ConnectionPool;
        },
    ) {
        this.ctx = args.ctx;
        this.relayPool = args.relayPool;
    }

    static Default(args: { ctx: NostrAccountContext; relayPool: ConnectionPool }) {
        const config = new RelayConfig(args);
        config.add(new URL(default_blowater_relay)).then((res) => {
            if (res instanceof Error) {
                console.error(res);
            }
        });
        return config;
    }

    // The relay config of this account from local storage
    static async FromLocalStorage(args: {
        ctx: NostrAccountContext;
        relayPool: ConnectionPool;
    }) {
        const encodedConfigStr = localStorage.getItem(this.localStorageKey(args.ctx));
        if (encodedConfigStr == null) {
            return RelayConfig.Default(args);
        }
        let relayArray = parseJSON<string[]>(encodedConfigStr);
        if (relayArray instanceof Error) {
            console.log(relayArray.message);
            relayArray = [];
        }
        const relayConfig = new RelayConfig(args);
        for (const relay of relayArray) {
            const url = newURL(relay);
            if (url instanceof Error) {
                console.error(relay, url);
                continue;
            }
            const err = await relayConfig.add(url);
            if (err instanceof Error) {
                console.error(err);
            }
        }
        return relayConfig;
    }
    static localStorageKey(ctx: NostrAccountContext) {
        return `${RelayConfig.name}-${ctx.publicKey.bech32()}`;
    }

    getRelayURLs() {
        const relays = this.relayPool.getRelays();
        const result = [];
        for (const relay of relays) {
            result.push(relay.url);
        }
        return result;
    }

    saveToLocalStorage() {
        console.log(RelayConfig.name, ":: saveToLocalStorage");
        localStorage.setItem(
            RelayConfig.localStorageKey(this.ctx),
            JSON.stringify(Array.from(this.relayPool.getRelays()).map((r) => url_identity(r.url))),
        );
    }

    async add(url: URL): Promise<Error | SingleRelayConnection> {
        console.log(RelayConfig.name, ":: add relay config", url);
        const relay = await this.relayPool.addRelayURL(url);
        if (relay instanceof Error) {
            return relay;
        }
        this.saveToLocalStorage();
        return relay;
    }

    async remove(url: URL) {
        if (url_identity(url) == url_identity(default_blowater_relay)) {
            return new RemoveBlowaterRelay();
        }
        await this.relayPool.removeRelay(url);
        this.saveToLocalStorage();
    }
}

export function applyPoolToRelayConfig(pool: ConnectionPool, relayConfig: RelayConfig) {
    for (const relay of pool.getRelays()) {
        relayConfig.add(relay.url);
    }
}

export class RemoveBlowaterRelay extends Error {}
