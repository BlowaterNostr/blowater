/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { NavBar } from "./nav.tsx";
import { testEventBus } from "./_setup.test.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";

const pool = new ConnectionPool();
await pool.addRelayURL("relay.blowater.app");
await pool.addRelayURL("nos.lol");

render(
    <NavBar
        emit={testEventBus.emit}
        profile={undefined}
        installPrompt={{ event: undefined }}
        publicKey={PrivateKey.Generate().toPublicKey()}
        pool={pool}
    />,
    document.body,
);
