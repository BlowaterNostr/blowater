/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Setting } from "./setting.tsx";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { defaultRelays, RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { EventBus } from "../event-bus.ts";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const relayConfig = RelayConfig.Empty();
for (const url of defaultRelays) {
    relayConfig.add(url);
}
const emitter = new EventBus();

render(
    Setting({
        relayConfig: relayConfig,
        relayPool: pool,
        myAccountContext: ctx,
        logout: () => {
            console.log("logout is clicked");
        },
        emit: emitter.emit,
    }),
    document.body,
);
