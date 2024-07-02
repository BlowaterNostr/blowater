/** @jsx h */
import { h, render } from "preact";
import { PrivateKey } from "@blowater/nostr-sdk";
import { InMemoryAccountContext, NostrKind } from "@blowater/nostr-sdk";
import { ProfileCard } from "./profile-card.tsx";
import { testEventBus } from "./_setup.test.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());

render(
    <div>
        <ProfileCard
            publicKey={ctx.publicKey}
            profileData={{
                about: "a nostr user",
                name: "Mike",
            }}
            emit={testEventBus.emit}
        />
        <ProfileCard publicKey={ctx.publicKey} profileData={undefined} emit={testEventBus.emit} />
        <ProfileCard
            publicKey={ctx.publicKey}
            profileData={{
                about: "I don't have a name",
            }}
            emit={testEventBus.emit}
        />
    </div>,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
