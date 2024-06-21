/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { SpaceDropDownPanel } from "./space-drop-down-panel.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <SpaceDropDownPanel
        currentRelay="wss://deno.blowater.app"
        emit={testEventBus.emit}
        spaceList={new Set(["wss://nos.lol", "wss://relay.damus.io", "wss://nostr.wine"])}
    />,
    document.body,
);
