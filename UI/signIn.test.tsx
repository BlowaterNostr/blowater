import { render } from "https://esm.sh/preact@10.17.1";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { eventBus } from "./_setup.test.ts";
import { SignIn } from "./signIn.tsx";

render(
    SignIn({
        eventBus: eventBus,
        state: "newAccount",
        privateKey: PrivateKey.Generate().bech32,
    }),
    document.body,
);

for await (const e of eventBus.onChange()) {
    console.log(e);
}
