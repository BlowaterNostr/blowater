/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Modal, ModalInputChannel } from "./modal.tsx";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { CenterClass } from "./tw.ts";
import { testEventBus } from "../_setup.test.ts";

const modalChan: ModalInputChannel = new Channel();

function ModalTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await modalChan.put({
                        children: <div class="h-20 w-40 bg-white text-black rounded">Modal Test</div>,
                    });
                }}
            >
                Show
            </button>
            <Modal inputChan={modalChan} />
        </div>
    );
}

render(<ModalTest />, document.body);

for await (const event of testEventBus.onChange()) {
    if (event.type === "HideModal") {
        await modalChan.put({ children: undefined });
    }
}
