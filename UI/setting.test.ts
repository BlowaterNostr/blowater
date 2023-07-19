import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { RelayConfig } from "./setting.ts";
import { InMemoryAccountContext, prepareCustomAppDataEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PrivateKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

Deno.test("Relay Config", async () => {
    const pool = new ConnectionPool();
    {
        const ctx = InMemoryAccountContext.New(PrivateKey.Generate())
        const rc = new RelayConfig(pool, ctx);
        const e = await prepareCustomAppDataEvent(ctx, {
            type: "AddRelay",
            url: "wss://nos.lol",
        })
        await rc.addEvents([e]);
    }
    await pool.close();
});
