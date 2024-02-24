/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RelaySwitchList } from "./relay-switch-list.tsx";
import { testEventBus } from "./_setup.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";

const pool = new ConnectionPool();
pool.addRelayURLs(["relay.blowater.app", "nos.lol", "relay.damus.io"]);

render(
    <RelaySwitchList emit={testEventBus.emit} pool={pool} />,
    document.body,
);
