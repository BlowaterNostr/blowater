import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { OtherConfig } from "./config-other.ts";
import { InMemoryAccountContext, NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

Deno.test("Pin List", async () => {
    const ctx = InMemoryAccountContext.Generate();
    const pusher = new Channel<NostrEvent>();
    const _ = new Channel<NostrEvent>();
    const config = OtherConfig.Empty(pusher, ctx);

    await config.addPin("a");
    assertEquals(config.getPinList(), new Set(["a"]));

    await config.addPin("b");
    assertEquals(config.getPinList(), new Set(["a", "b"]));

    // able to restore the config from local storage
    const config2 = await OtherConfig.FromLocalStorage(ctx, _);
    assertEquals(config2.getPinList(), new Set(["a", "b"]));
    assertEquals(config2.getPinList(), config.getPinList());

    // able to restore the config from event logs
    const config3 = OtherConfig.Empty(_, ctx);
    const event1 = await pusher.pop() as NostrEvent;
    const event2 = await pusher.pop() as NostrEvent;
    {
        const err = await config3.addEvent(event1);
        if (err instanceof Error) fail(err.message);
    }
    {
        const err = await config3.addEvent(event2);
        if (err instanceof Error) fail(err.message);
    }
    assertEquals(config3.getPinList(), new Set(["a", "b"]));
    assertEquals(config3.getPinList(), config.getPinList());

    // remove 1 pin from config1
    await config.removePin("a");
    assertEquals(config.getPinList(), new Set(["b"]));

    // config3 is able to sync with config1
    const event3 = await pusher.pop() as NostrEvent;
    {
        const err = await config3.addEvent(event3);
        if (err instanceof Error) fail(err.message);
    }
    assertEquals(config3.getPinList(), new Set(["b"]));
});
