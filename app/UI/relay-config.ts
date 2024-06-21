import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { parseJSON } from "../features/profile.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";

export const default_blowater_relay = "wss://blowater.nostr1.com";

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
        config.add(default_blowater_relay).then((res) => {
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
            const err = await relayConfig.add(relay);
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
        return new Set(Array.from(this.relayPool.getRelays()).map((r) => r.url));
    }

    saveToLocalStorage() {
        console.log(RelayConfig.name, ":: saveToLocalStorage");
        localStorage.setItem(
            RelayConfig.localStorageKey(this.ctx),
            JSON.stringify(Array.from(this.relayPool.getRelays()).map((r) => r.url)),
        );
    }

    async add(url: string): Promise<Error | SingleRelayConnection> {
        console.log(RelayConfig.name, ":: add relay config", url);
        const relay = await this.relayPool.addRelayURL(url);
        if (relay instanceof Error) {
            return relay;
        }
        this.saveToLocalStorage();
        return relay;
    }

    async remove(url: string) {
        if (url == default_blowater_relay) {
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
