/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Setting } from "./setting.tsx";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { defaultRelays, RelayConfig } from "./setting.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const relayConfig = new RelayConfig();
for (const url of defaultRelays) {
    relayConfig.add(url);
}
render(
    Setting({
        relayConfig: relayConfig,
        relayPool: pool,
        myAccountContext: ctx,
        logout: () => {
            console.log("logout is clicked");
        },
    }),
    document.body,
);
