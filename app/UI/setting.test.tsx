import { render } from "https://esm.sh/preact@10.17.1";
import { Setting } from "./setting.tsx";
import { RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { testEventBus } from "./_setup.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";

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
