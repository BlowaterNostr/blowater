/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { SpaceDropDownPanel } from "./space-drop-down-panel.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <SpaceDropDownPanel
        currentRelay="123"
        emit={testEventBus.emit}
        spaceList={new Set(["relay.blowater.app", "nos.lol", "relay.damus.io", "nostr.wine"])}
    />,
    document.body,
);
