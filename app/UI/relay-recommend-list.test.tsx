/** @jsx h */
import { h, render } from "preact";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { testEventBus } from "./_setup.test.ts";
import { RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "@blowater/nostr-sdk";
import { ConnectionPool } from "@blowater/nostr-sdk";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.Generate();
const relayConfig = RelayConfig.Default({ ctx, relayPool: pool });

render(
    <RelayRecommendList
        relayConfig={relayConfig}
        emit={testEventBus.emit}
        getRelayRecommendations={() => new Set()}
    />,
    document.body,
);
