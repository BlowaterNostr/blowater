/** @jsx h */
import { ComponentChildren, h, render } from "preact";
import { Modal, ModalInputChannel } from "./components/modal.tsx";
import { chan, Channel, sleep } from "@blowater/csp";
import { CenterClass } from "./components/tw.ts";
import { testEventBus } from "./_setup.test.ts";
import { SpaceSetting } from "./relay-detail.tsx";
import { InMemoryAccountContext, RelayInformation } from "@blowater/nostr-sdk";

const ctx = InMemoryAccountContext.Generate();
const spaceUrl = new URL("ws://localhost:8080/");
const modalChan: ModalInputChannel = new Channel<{
    children: ComponentChildren;
    onClose?: (() => void) | undefined;
}>();
const spaceInformationChan = () => {
    const c = chan<Error | RelayInformation>();
    (async () => {
        const info: RelayInformation = {
            name: "space setting modal test",
            description: "Test description",
            pubkey: ctx.publicKey.hex,
            contact: "test contact",
            supported_nips: [1, 2, 3],
            software: "test software",
            version: "test version",
            icon:
                "https://image.nostr.build/655007ae74f24ea1c611889f48b25cb485b83ab67408daddd98f95782f47e1b5.jpg",
        };
        for (;;) {
            if (c.closed()) return;
            const err = await c.put(info);
            if (err instanceof Error) {
                return;
            }
            await sleep(3000); // every 3 sec
        }
    })();
    return c;
};
const memberSet = new Set<string>();
for (let i = 0; i < 10; i++) {
    memberSet.add(InMemoryAccountContext.Generate().publicKey.hex);
}

function ModalTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await modalChan.put({
                        children: (
                            <SpaceSetting
                                emit={testEventBus.emit}
                                getSpaceInformationChan={spaceInformationChan}
                                getMemberSet={() => memberSet}
                                spaceUrl={spaceUrl}
                                getProfileByPublicKey={() => undefined}
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
