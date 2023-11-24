import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool, RelayAdder, RelayGetter, RelayRemover } from "../lib/nostr-ts/relay-pool.ts";
import { parseJSON } from "../features/profile.ts";
import { SingleRelayConnection } from "../lib/nostr-ts/relay-single.ts";
import { RelayConfigChange } from "./setting.tsx";
import { blowater } from "../lib/nostr-ts/relay-list.test.ts";

export const defaultRelays = [
    "wss://relay.blowater.app",
    "wss://nos.lol",
    "wss://relay.damus.io",
    "wss://relay.nostr.wirednet.jp",
];

export class RelayConfig {
    private config = new Set<string>();
    private readonly ctx: NostrAccountContext;
    private readonly relayPool: RelayAdder & RelayRemover & RelayGetter;

    private constructor(
        args: {
            ctx: NostrAccountContext;
            relayPool: RelayAdder & RelayRemover & RelayGetter;
        },
    ) {
        this.ctx = args.ctx;
        this.relayPool = args.relayPool;
    }

    static Default(args: { ctx: NostrAccountContext; relayPool: RelayAdder & RelayRemover & RelayGetter }) {
        const config = new RelayConfig(args);
        config.add(blowater).then((res) => {
            if (res instanceof Error) {
                console.error(res);
            }
        });
        return config;
    }

    // The the relay config of this account from local storage
    static async FromLocalStorage(args: {
        ctx: NostrAccountContext;
        relayPool: RelayAdder & RelayRemover & RelayGetter;
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

    async addEvent(event: NostrEvent<NostrKind.Custom_App_Data>) {
        const content = await this.ctx.encrypt(this.ctx.publicKey.hex, event.content);
        if (content instanceof Error) {
            return content;
        }
        const configChange = parseJSON<RelayConfigChange>(content);
        if (configChange instanceof Error) {
            return configChange;
        }
        if (configChange.type != "RelayConfigChange") {
            return; // ignore
        }
        if (configChange.kind == "add") {
            this.config.add(configChange.url);
        } else {
            this.config.delete(configChange.url);
        }
    }

    getRelayURLs() {
        return this.config;
    }

    saveToLocalStorage() {
        console.log(RelayConfig.name, ":: saveToLocalStorage");
        localStorage.setItem(RelayConfig.localStorageKey(this.ctx), JSON.stringify(Array.from(this.config)));
    }

    async add(url: string): Promise<Error | SingleRelayConnection> {
        console.log(RelayConfig.name, ":: add relay config", url);
        const relay = await this.relayPool.addRelayURL(url);
        if (relay instanceof Error) {
            return relay;
        }
        this.config.add(relay.url);
        this.saveToLocalStorage();
        return relay;
    }

    async remove(url: string) {
        if (url == blowater) {
            return new RemoveBlowaterRelay();
        }
        await this.relayPool.removeRelay(url);
        const ok = this.config.delete(url);
        this.saveToLocalStorage();
        return ok;
    }
}

export function applyPoolToRelayConfig(pool: ConnectionPool, relayConfig: RelayConfig) {
    for (const relay of pool.getRelays()) {
        relayConfig.add(relay.url);
    }
}

export class RemoveBlowaterRelay extends Error {}
