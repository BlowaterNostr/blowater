/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RightPanel } from "./right-panel.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <div class="border">
        <RightPanel
            emit={testEventBus.emit}
            rightPanelModel={{
                show: true,
            }}
        >
            Test
        </RightPanel>
    </div>,
    document.body,
);
