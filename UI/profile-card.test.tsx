/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
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
