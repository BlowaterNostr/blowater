import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { RelayConfig } from "./relay-config.ts";
import { blowater } from "../lib/nostr-ts/relay-list.test.ts";

Deno.test("relay config", async () => {
    const pool = new ConnectionPool();
    const ctx = InMemoryAccountContext.Generate();
    {
        const config = RelayConfig.Empty({
            ctx,
            relayPool: pool,
        });

        const urls = config.getRelayURLs();
        assertEquals(urls, new Set());

        const err = await config.add(blowater);
        if (err instanceof Error) fail(err.message);
        assertEquals(config.getRelayURLs(), new Set([blowater]));

        config.saveToLocalStorage();
    }
    {
        const config = await RelayConfig.FromLocalStorage({
            ctx,
            relayPool: pool,
        });
        assertEquals(config.getRelayURLs(), new Set([blowater]));
    }
    await pool.close();
});
