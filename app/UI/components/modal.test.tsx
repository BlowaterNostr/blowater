/** @jsx h */
import { h, render } from "preact";
import { HideModal, Modal, ModalInputChannel } from "./modal.tsx";
import { Channel } from "@blowater/csp";
import { CenterClass } from "./tw.ts";
import { testEventBus } from "../_setup.test.ts";
import { emitFunc } from "../../event-bus.ts";

const modalChan: ModalInputChannel = new Channel();

function ModalTest(props: {
    emit: emitFunc<HideModal>;
}) {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await modalChan.put({
                        children: (
                            <div class="h-20 w-40 bg-white text-black rounded flex flex-col justify-center items-center">
                                <div>
                                    Modal Test
                                </div>
                                <button
                                    class="rounded bg-[#007FFF] px-4 py2"
                                    onClick={async () => {
                                        await props.emit({
                                            type: "HideModal",
                                            onClose() {
                                                console.log("close the modal by HideModal");
                                            },
                                        });
                                    }}
                                >
                                    close
                                </button>
                            </div>
                        ),
                        onClose() {
                            console.log("close the modal by click");
                        },
                    });
                }}
            >
                Show
            </button>
            <Modal inputChan={modalChan} />
        </div>
    );
}

render(<ModalTest emit={testEventBus.emit} />, document.body);

for await (const event of testEventBus.onChange()) {
    if (event.type === "HideModal") {
        await modalChan.put({ children: undefined, onClose: event.onClose });
    }
}
