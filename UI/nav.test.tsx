/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";

import { NewIndexedDB } from "./db.ts";

import * as nav from "./nav.tsx";
import { tw } from "https://esm.sh/twind@0.16.16";

import { EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";

const db = await NewIndexedDB();
if (db instanceof Error) {
    throw db;
}
const NavProps: nav.Props = {
    publicKey: PublicKey.FromHex(
        "0add27aa36e2e5e2591370f485af1344447705cfc37b1a1e6b0224be878c9687",
    ) as PublicKey,
    database: db,
    pool: new ConnectionPool(),
    eventEmitter: new EventBus<UI_Interaction_Event>(),
    AddRelayButtonClickedError: "",
    AddRelayInput: "",
    activeNav: "DM",
    picture: undefined,
};

export default function NavTest() {
    return (
        <div class={tw`h-screen`}>
            <nav.NavBar
                {...NavProps}
            />
        </div>
    );
}

render(<NavTest />, document.body);
