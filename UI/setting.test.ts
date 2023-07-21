import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { RelayConfig } from "./setting.ts";
import {
    InMemoryAccountContext,
    NostrAccountContext,
    prepareCustomAppDataEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PrivateKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { transformEvent } from "../database.ts";
import { CustomAppData } from "../nostr.ts";

Deno.test("Relay Config", async () => {
    const pool = new ConnectionPool();
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

        const rc1 = new RelayConfig(pool, ctx);
        await rc1.addEvents([e1, e2, e3]);

        const rc2 = new RelayConfig(pool, ctx);
        await rc2.addEvents([e2, e1, e3]);

        assertEquals(rc1.getRelayURLs(), rc2.getRelayURLs());
        assertEquals(rc1.getRelayURLs(), ["wss://relay.damus.io"]);
    }
    await pool.close();
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
