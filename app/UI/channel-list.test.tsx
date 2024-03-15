import { h, render } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <ChannelList
        emit={testEventBus.emit}
        relay="test"
        currentSelected="test"
        channels={["general", "games", "work"]}
    >
    </ChannelList>,
    document.body,
);
