import { render } from "preact";
import { Setting } from "./setting.tsx";
import { RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "@blowater/nostr-sdk";
import { PrivateKey } from "@blowater/nostr-sdk";
import { testEventBus } from "./_setup.test.ts";
import { ConnectionPool } from "@blowater/nostr-sdk";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const relayConfig = RelayConfig.Default({ ctx, relayPool: pool });

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
