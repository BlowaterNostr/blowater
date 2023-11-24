/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Setting } from "./setting.tsx";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { defaultRelays, RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { testEventBus } from "./_setup.test.ts";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const relayConfig = RelayConfig.Default(ctx, pool);
for (const url of defaultRelays) {
    relayConfig.add(url);
}

render(
    Setting({
        emit: testEventBus.emit,
        myAccountContext: ctx,
        logout: () => {},
        relayConfig: relayConfig,
        relayPool: pool,
        show: true,
    }),
    document.body,
);
