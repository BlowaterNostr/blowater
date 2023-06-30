/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.ts";
import { RelaySetting } from "./setting.tsx";
import { relays } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay-list.test.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";

const pool = new ConnectionPool();
pool.addRelayURLs(relays).then((errs) => {
    if (errs) {
        console.log(errs);
    }
});

const bus = new EventBus<UI_Interaction_Event>();

for (;;) {
    render(
        <RelaySetting
            err=""
            eventBus={bus}
            input=""
            relays={pool.getRelays().map((r) => ({
                status: r.ws.status(),
                url: r.url,
            }))}
        />,
        document.body,
    );
    await sleep(100); // 10 FPS
}
