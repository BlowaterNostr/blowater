/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { testEventBus } from "./_setup.test.ts";
import { defaultRelays, RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "@blowater/nostr-sdk";
import { ConnectionPool } from "@blowater/nostr-sdkrelay-pool.ts";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.Generate();
const relayConfig = RelayConfig.Default({ ctx, relayPool: pool });
for (const url of defaultRelays) {
    relayConfig.add(url);
}

render(
    <RelayRecommendList
        relayConfig={relayConfig}
        emit={testEventBus.emit}
    />,
    document.body,
);
