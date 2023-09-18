import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { OtherConfig } from "./config-other.ts";
import { prepareParameterizedEvent } from "../lib/nostr-ts/event.ts";
import { InMemoryAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";

Deno.test("Other Configs", async () => {
    {
        const config = OtherConfig.Empty();
        assertEquals(config.pinList, new Set());
    }

    const ctx = InMemoryAccountContext.Generate();

    {   // Encode/Decode To/From Nostr Event
        const pub = PrivateKey.Generate().toPublicKey();
        const pub2 = PrivateKey.Generate().toPublicKey();
        const event = await prepareParameterizedEvent(ctx, {
            content: await ctx.encrypt(ctx.publicKey.hex, JSON.stringify([pub.bech32(), "123", pub2.bech32(), pub2.hex])),
            kind: NostrKind.Custom_App_Data,
            d: OtherConfig.name,
        });
        const config = await OtherConfig.FromNostrEvent(event, ctx);
        if (config instanceof Error) fail(config.message);
        assertEquals(config.pinList, new Set([pub.bech32(), pub2.bech32()]));

        // encode back to events
    }
});
