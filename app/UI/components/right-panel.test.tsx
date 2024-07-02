/** @jsx h */
import { h, render } from "preact";
import { RightPanel } from "./right-panel.tsx";
import { ComponentChildren } from "preact";
import { Channel } from "@blowater/csp";
import { CenterClass } from "./tw.ts";

const rightPanelChan: Channel<() => ComponentChildren> = new Channel();
function RightPanelTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await rightPanelChan.put(
                        () => (
                            <div
                                class={`${CenterClass} p-10`}
                            >
                                RightPanel Simple
                            </div>
                        ),
                    );
                }}
            >
                Show
            </button>
            <RightPanel inputChan={rightPanelChan} />
        </div>
    );
}

render(<RightPanelTest />, document.body);
