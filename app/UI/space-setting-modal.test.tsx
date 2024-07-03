/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Modal, ModalInputChannel } from "./components/modal.tsx";
import { Channel, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { CenterClass } from "./components/tw.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { emitFunc } from "../event-bus.ts";
import { SpaceSetting } from "./relay-detail.tsx";
import { UI_Interaction_Event } from "./app_update.tsx";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { RelayInformation } from "../../libs/nostr.ts/nip11.ts";

const ctx = InMemoryAccountContext.Generate();
const spaceUrl = new URL("ws://localhost:8080/");
const modalChan: ModalInputChannel = new Channel();
const spaceInformationChan = () => {
    const chan = csp.chan<Error | RelayInformation>();
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
            if (chan.closed()) return;
            const err = await chan.put(info);
            if (err instanceof Error) {
                return;
            }
            await sleep(3000); // every 3 sec
        }
    })();
    return chan;
};
const memberSet = new Set<string>();
for (let i = 0; i < 10; i++) {
    memberSet.add(InMemoryAccountContext.Generate().publicKey.hex);
}

function ModalTest(props: {
    emit: emitFunc<UI_Interaction_Event>;
}) {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await modalChan.put({
                        children: (
                            <SpaceSetting
                                emit={props.emit}
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

render(<ModalTest emit={testEventBus.emit} />, document.body);

for await (const event of testEventBus.onChange()) {
    if (event.type === "HideModal") {
        await modalChan.put({ children: undefined, onClose: event.onClose });
    }
}
