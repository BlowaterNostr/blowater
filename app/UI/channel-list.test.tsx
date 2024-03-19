import { h, render } from "https://esm.sh/preact@10.17.1";
import { PublicFilterList } from "./channel-list.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <PublicFilterList
        emit={testEventBus.emit}
        relay="test"
        currentSelected="test"
        channels={["general", "games", "work"]}
    >
    </PublicFilterList>,
    document.body,
);
