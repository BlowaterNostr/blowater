/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RightPanel, RightPanelInputChannel } from "./right-panel.tsx";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { CenterClass } from "./tw.ts";

const rightPanelChan: RightPanelInputChannel = new Channel();
function RightPanelTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await rightPanelChan.put({
                        children: (
                            <div
                                class={`${CenterClass} p-10`}
                            >
                                RightPanel Simple
                            </div>
                        ),
                        onClose: () => console.log("close"),
                    });
                }}
            >
                Show
            </button>
            <RightPanel inputChan={rightPanelChan} />
        </div>
    );
}

render(<RightPanelTest />, document.body);
