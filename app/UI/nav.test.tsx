/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { NavBar } from "./nav.tsx";
import { testEventBus } from "./_setup.test.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";

const pool = new ConnectionPool();
await pool.addRelayURLs(
    [
        "relay.blowater.app",
        "nos.lol",
        "relay.damus.io",
        "nostr.wine",
        "wss://relay.nostr.wirednet.jp",
        "wss://relay.nostr.moctane.com",
        "wss://remnant.cloud",
        "wss://nostr.cahlen.org",
        "wss://fog.dedyn.io",
        "wss://global-relay.cesc.trade",
        "wss://nostr.dakukitsune.ca",
        "wss://africa.nostr.joburg",
        "wss://nostr-relay.ktwo.io",
        "wss://bevo.nostr1.com",
        "wss://relay.corpum.com",
        "wss://relay.nostr.directory",
        "wss://nostr.1f52b.xyz",
        "wss://lnbits.eldamar.icu/nostrrelay/relay",
        "wss://relay.cosmicbolt.net",
        "wss://island.nostr1.com",
        "wss://nostr.codingarena.de",
        "wss://nostr.madco.me",
        "wss://nostr-relay.bitcoin.ninja",
    ],
);

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
