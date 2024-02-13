/** @jsx h */
import { ComponentChild, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { NavBar } from "./nav.tsx";
import { testEventBus } from "./_setup.test.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";

render(
    <NavBar
        emit={testEventBus.emit}
        profile={undefined}
        installPrompt={{ event: undefined }}
        publicKey={PrivateKey.Generate().toPublicKey()}
    />,
    document.body,
);
