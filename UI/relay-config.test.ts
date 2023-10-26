import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { RelayConfig } from "./relay-config.ts";
import { assertEquals, assertNotInstanceOf, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";

Deno.test("Relay Config", async () => {
    const relayConfig = RelayConfig.Empty();
    {
        const urls = relayConfig.getRelayURLs();
        assertEquals(urls.size, 0);

        relayConfig.add("wss://nos.lol");
        const urls2 = relayConfig.getRelayURLs();
        assertEquals(urls2, new Set(["wss://nos.lol"]));

        relayConfig.add("nos.lol"); // will add protocol prefix
        assertEquals(relayConfig.getRelayURLs(), new Set(["wss://nos.lol"]));
    }

    const relayConfig2 = RelayConfig.Empty();
    {
        const urls = relayConfig2.getRelayURLs();
        assertEquals(urls.size, 0);

        relayConfig2.add("wss://relay.damus.io");
        const urls2 = relayConfig2.getRelayURLs();
        assertEquals(urls2, new Set(["wss://relay.damus.io"]));
    }

    relayConfig.merge(relayConfig2.save());
    relayConfig2.merge(relayConfig.save());

    assertEquals(relayConfig.getRelayURLs(), relayConfig2.getRelayURLs());
    assertEquals(relayConfig.getRelayURLs(), new Set(["wss://nos.lol", "wss://relay.damus.io"]));

    {
        relayConfig.remove("not exist");
        assertEquals(relayConfig.getRelayURLs(), new Set(["wss://nos.lol", "wss://relay.damus.io"]));

        relayConfig.remove("wss://nos.lol");
        assertEquals(relayConfig.getRelayURLs(), new Set(["wss://relay.damus.io"]));

        relayConfig2.add("wss://somewhere");
        assertEquals(
            relayConfig2.getRelayURLs(),
            new Set(["wss://nos.lol", "wss://relay.damus.io", "wss://somewhere"]),
        );

        relayConfig.merge(relayConfig2.save());
        relayConfig2.merge(relayConfig.save());

        assertEquals(relayConfig.getRelayURLs(), relayConfig2.getRelayURLs());
        assertEquals(relayConfig.getRelayURLs(), new Set(["wss://relay.damus.io", "wss://somewhere"]));
    }

    const ctx = InMemoryAccountContext.Generate();
    const event = await relayConfig.toNostrEvent(ctx);
    if (event instanceof Error) fail(event.message);

    const relayConfig3 = await RelayConfig.FromNostrEvent(event, ctx);
    if (relayConfig3 instanceof Error) fail(relayConfig3.message);

    assertEquals(relayConfig3.getRelayURLs(), relayConfig.getRelayURLs());

    { // synchronize with connection pool
        const pool = new ConnectionPool();
        {
            const err = await relayConfig.syncWithPool(pool);
            if (err != undefined) {
                assertEquals(err.message, "wss://somewhere/ has been closed, can't wait for it to open");
            }

            // add one relay to the pool directly
            assertNotInstanceOf(pool.addRelayURL("wss://relay.nostr.wirednet.jp"), Error);
            assertEquals(pool.getRelays().map((r) => r.url), [
                "wss://relay.damus.io",
                "wss://relay.nostr.wirednet.jp",
            ]);

            assertEquals(relayConfig.getRelayURLs(), new Set(["wss://relay.damus.io", "wss://somewhere"]));

            // will remove urls that's in the pool but not in the config
            const err2 = await relayConfig.syncWithPool(pool);
            if (err2 != undefined) {
                assertEquals(err2.message, "wss://somewhere/ has been closed, can't wait for it to open");
            }
            assertEquals(pool.getRelays().map((r) => r.url), ["wss://relay.damus.io"]); // wirednet is removed
        }
        await pool.close();
    }
});

Deno.test("RelayConfig: Nostr Encoding Decoding", async () => {
    const config = RelayConfig.Empty();
    config.add("something");

    const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
    const event = await config.toNostrEvent(ctx);
    if (event instanceof Error) fail(event.message);

    const config2 = await RelayConfig.FromNostrEvent(event, ctx);
    if (config2 instanceof Error) fail(config2.message);

    console.log(config.getRelayURLs(), config2.getRelayURLs());
    assertEquals(config.getRelayURLs(), config2.getRelayURLs());
});
