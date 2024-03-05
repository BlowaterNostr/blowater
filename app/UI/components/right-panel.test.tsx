/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RightPanel } from "./right-panel.tsx";
import { ComponentChildren } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { CenterClass } from "./tw.ts";

const rightPanelChan: Channel<() => ComponentChildren> = new Channel();
function RightPanelTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await rightPanelChan.put(
                        <div
                            class={`${CenterClass} p-10`}
                        >
                            RightPanel Simple
                        </div>,
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
