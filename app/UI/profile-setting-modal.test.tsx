/** @jsx h */
import { ComponentChildren, h, render } from "preact";
import { Modal, ModalInputChannel } from "./components/modal.tsx";
import { Channel } from "@blowater/csp";
import { CenterClass } from "./components/tw.ts";
import { prepareProfileEvent, testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext } from "@blowater/nostr-sdk";
import { EditProfile } from "./edit-profile.tsx";

const ctx = InMemoryAccountContext.Generate();
const modalChan: ModalInputChannel = new Channel<{
    children: ComponentChildren;
    onClose?: (() => void) | undefined;
}>();

const profileEvent = await prepareProfileEvent(ctx, { name: "test_name" });

function ModalTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await modalChan.put({
                        children: (
                            <EditProfile
                                ctx={ctx}
                                profile={profileEvent.profile}
                                emit={testEventBus.emit}
                            />
                        ),
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
        await modalChan.put({ children: undefined, onClose: event.onClose });
    }
}
