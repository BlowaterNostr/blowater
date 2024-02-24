/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { testEventBus } from "./_setup.test.ts";
import { defaultRelays, RelayConfig } from "./relay-config.ts";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";

const pool = new ConnectionPool();
const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const relayConfig = RelayConfig.Default({ ctx, relayPool: pool });
for (const url of defaultRelays) {
    relayConfig.add(url);
}

render(
    <div
        class={`flex flex-col justify-center items-centeh-[80%] absolute top-[20%] overflow-auto bg-[#27272A] w-full shadow-inner`}
    >
        <RelayRecommendList
            relayConfig={relayConfig}
            emit={testEventBus.emit}
        />
    </div>,
    document.body,
);
