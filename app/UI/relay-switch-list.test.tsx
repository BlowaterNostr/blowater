/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RelaySwitchList } from "./relay-switch-list.tsx";
import { testEventBus } from "./_setup.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";

const pool = new ConnectionPool();
pool.addRelayURLs(
    [
        "blowater.nostr1.com",
        "nos.lol",
        "relay.damus.io",
        "nostr.wine",
        "relay.nostr.wirednet.jp",
        "yabu.me",
        "relay.nostr.band",
        "bevo.nostr1.com",
        "island.nostr1.com",
        "vitor.nostr1.com",
        "frens.nostr1.com",
        "shawn.nostr1.com",
        "fiatjaf.nostr1.com",
        "nostrdevs.nostr1.com",
    ],
);

render(
    <RelaySwitchList emit={testEventBus.emit} pool={pool} />,
    document.body,
);
