import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { OtherConfig } from "./config-other.ts";
import { InMemoryAccountContext, NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

Deno.test("Pin List", async () => {
    const ctx = InMemoryAccountContext.Generate();
    const pusher = new Channel<NostrEvent>();
    const config = OtherConfig.Empty(pusher);

    await config.addPin("a", ctx);
    assertEquals(config.getPinList(), new Set(["a"]));

    await config.addPin("b", ctx);
    assertEquals(config.getPinList(), new Set(["a", "b"]));

    const err = await config.saveToLocalStorage(ctx);
    if (err instanceof Error) fail(err.message);

    const config2 = await OtherConfig.FromLocalStorage(ctx, pusher);
    assertEquals(config2.getPinList(), new Set(["a", "b"]));
    assertEquals(config2.getPinList(), config.getPinList());

    await pusher.pop()
    await pusher.pop()
});
