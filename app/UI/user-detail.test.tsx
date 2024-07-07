/** @jsx h */
import { h, render } from "preact";
import { Channel } from "@blowater/csp";
import { CenterClass } from "./components/tw.ts";
import { prepareProfileEvent, testEventBus } from "./_setup.test.ts";
import { InMemoryAccountContext } from "@blowater/nostr-sdk";
import { RightPanel, RightPanelChannel } from "./components/right-panel.tsx";
import { UserDetail } from "./user-detail.tsx";

const ctx = InMemoryAccountContext.Generate();
const rightPanelChan: RightPanelChannel = new Channel();

const profileEvent = await prepareProfileEvent(ctx, {
    name: "test_name",
    display_name: "Orionna Lumis",
    about:
        "Celestial bodies move in a harmonious dance, bound by the tether of gravity. Their ballet paints stories in the sky.",
    website: "https://github.com",
    picture: "https://image.nostr.build/655007ae74f24ea1c611889f48b25cb485b83ab67408daddd98f95782f47e1b5.jpg",
});

function UserDetailTest() {
    return (
        <div class={`${CenterClass} w-screen h-screen text-white`}>
            <button
                class={`rounded bg-black px-4 py2`}
                onClick={async () => {
                    await rightPanelChan.put(() => (
                        <UserDetail
                            targetUserProfile={profileEvent.profile}
                            pubkey={profileEvent.publicKey}
                            blocked={false}
                            emit={testEventBus.emit}
                        />
                    ));
                }}
            >
                Show
            </button>
            <RightPanel inputChan={rightPanelChan} />
        </div>
    );
}

render(<UserDetailTest />, document.body);

for await (const event of testEventBus.onChange()) {
    if (event.type === "HideModal") {
        await rightPanelChan.put(() => undefined);
    }
}
