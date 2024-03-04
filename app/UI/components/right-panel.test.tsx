/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RightPanel } from "./right-panel.tsx";
import { testEventBus } from "../_setup.test.ts";

render(
    <div class="border">
        <RightPanel
            emit={testEventBus.emit}
            eventSub={testEventBus}
        >
            Test
        </RightPanel>
    </div>,
    document.body,
);

const rightPanelChan: PopOverInputChannel = new Channel();
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
