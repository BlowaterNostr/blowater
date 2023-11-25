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

    // able to restore the config from local storage
    const config2 = await OtherConfig.FromLocalStorage(ctx, pusher);
    assertEquals(config2.getPinList(), new Set(["a", "b"]));
    assertEquals(config2.getPinList(), config.getPinList());

    // able to restore the config from event logs
    const config3 = OtherConfig.Empty(pusher);
    const event1 = await pusher.pop() as NostrEvent;
    const event2 = await pusher.pop() as NostrEvent;
    await config3.addEvent(event1);
    await config3.addEvent(event2);
    assertEquals(config3.getPinList(), new Set(["a", "b"]));
    assertEquals(config3.getPinList(), config.getPinList());
});
