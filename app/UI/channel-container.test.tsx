import { h, render } from "https://esm.sh/preact@10.17.1";
import { ChannelContainer } from "./channel-container.tsx";
import { relays } from "../../libs/nostr.ts/relay-list.test.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { testEventBus } from "./_setup.test.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";

const pool = new ConnectionPool();
pool.addRelayURL(relays[0]);

const relay = pool.getRelay(relays[0]) as SingleRelayConnection;

render(
    <ChannelContainer
        relay={relay}
        bus={testEventBus}
        currentChannel={undefined}
        relaySelectedChannel={new Map()}
    />,
    document.body,
);
