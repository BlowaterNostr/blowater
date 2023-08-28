import { ConnectionPool } from "../lib/nostr.ts/relay.ts";
import { RelayConfig } from "./setting.ts";
import {
    InMemoryAccountContext,
    NostrAccountContext,
    prepareCustomAppDataEvent,
} from "../lib/nostr.ts/nostr.ts";
import { PrivateKey } from "../lib/nostr.ts/key.ts";
import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { transformEvent } from "../database.ts";
import { CustomAppData } from "../nostr.ts";

Deno.test("Relay Config", async () => {
    const pool1 = new ConnectionPool();
    const pool2 = new ConnectionPool();
    {
        const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
        const e1 = await prepareData(ctx, {
            type: "AddRelay",
            url: "wss://nos.lol",
            vc: 1,
        });
        const e2 = await prepareData(ctx, {
            type: "RemoveRelay",
            url: "wss://nos.lol",
            vc: 2,
        });
        const e3 = await prepareData(ctx, {
            type: "AddRelay",
            url: "wss://relay.damus.io",
            vc: 1,
        });
        const e4 = await prepareData(ctx, {
            type: "RemoveRelay",
            url: "wss://relay.damus.io",
            vc: 2,
        });
        const e5 = await prepareData(ctx, {
            type: "AddRelay",
            url: "wss://relay.damus.io",
            vc: 3,
        });

        const rc1 = new RelayConfig(pool1, ctx);
        await rc1.addEvents([e1]);
        assertEquals(rc1.getRelayURLs(), new Set(["wss://nos.lol"]));
        assertEquals(new Set(pool1.getRelays().map((r) => r.url)), rc1.getRelayURLs());

        await rc1.addEvents([e2, e3, e4, e5]);

        const events = [e1, e2, e3, e4, e5].sort((_) => Math.random() - 1);
        const chunkSize = Math.random() * 5;
        const chunk1 = events.slice(0, chunkSize);
        const chunk2 = events.slice(chunkSize);
        const rc2 = new RelayConfig(pool2, ctx);
        await rc2.addEvents(chunk1);
        await rc2.addEvents(chunk2);

        assertEquals(rc1.getRelayURLs(), rc2.getRelayURLs());
        assertEquals(rc1.getRelayURLs(), new Set(["wss://relay.damus.io"]));

        assertEquals(new Set(pool1.getRelays().map((r) => r.url)), rc1.getRelayURLs());
        assertEquals(new Set(pool2.getRelays().map((r) => r.url)), rc2.getRelayURLs());
    }
    await pool1.close();
    await pool2.close();
});

async function prepareData(ctx: NostrAccountContext, data: CustomAppData) {
    const e = await prepareCustomAppDataEvent(ctx, data);
    if (e instanceof Error) {
        fail(e.message);
    }
    const customAppDataEvent = await transformEvent(e, ctx);
    if (customAppDataEvent instanceof Error) {
        fail(customAppDataEvent.message);
    }
    if (customAppDataEvent == undefined) {
        fail();
    }
    return customAppDataEvent;
}
