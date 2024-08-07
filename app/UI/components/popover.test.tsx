/** @jsx h */
import { h, render } from "preact";
import { Popover, PopOverInputChannel } from "./popover.tsx";
import { Channel } from "@blowater/csp";
import { CenterClass } from "./tw.ts";

const popoverChan: PopOverInputChannel = new Channel();
function PopoverTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await popoverChan.put({
                        children: (
                            <div
                                class={`${CenterClass} p-10`}
                            >
                                Popover Simple
                            </div>
                        ),
                        onClose: () => console.log("close"),
                    });
                }}
            >
                Show
            </button>
            <Popover inputChan={popoverChan} />
        </div>
    );
}

render(<PopoverTest />, document.body);
