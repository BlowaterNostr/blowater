import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { RelayConfig } from "./setting.ts";
import { InMemoryAccountContext } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PrivateKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

Deno.test("Relay Config", async () => {
    const pool = new ConnectionPool();
    {
        const rc = new RelayConfig(pool, InMemoryAccountContext.New(PrivateKey.Generate()));

        await rc.addEvents([
            {
                customAppData: {
                    type: "AddRelay",
                    url: "wss://nos.lol",
                },
            },
        ]);
    }
    await pool.close();
});
