import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { OtherConfig } from "./config-other.ts";
import { InMemoryAccountContext, NostrEvent } from "../../0_lib/nostr-ts/nostr.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { LamportTime } from "../../time.ts";

Deno.test("Pin List", async () => {
    const ctx = InMemoryAccountContext.Generate();
    const pusher = new Channel<NostrEvent>();
    const _ = new Channel<NostrEvent>();
    const lamport = new LamportTime();
    const config = OtherConfig.Empty(pusher, ctx, lamport);

    await config.addPin("a");
    assertEquals(config.getPinList(), new Set(["a"]));

    await config.addPin("b");
    assertEquals(config.getPinList(), new Set(["a", "b"]));

    // able to restore the config from local storage
    {
        const config2 = await OtherConfig.FromLocalStorage(ctx, _, lamport);
        assertEquals(config2.getPinList(), new Set(["a", "b"]));
        assertEquals(config2.getPinList(), config.getPinList());
    }

    // remove 1 pin from config1
    await config.removePin("a");
    assertEquals(config.getPinList(), new Set(["b"]));

    // config3 is able to sync with config1
    // able to restore the config from event logs
    const config3 = OtherConfig.Empty(_, ctx, lamport);
    const event1 = await pusher.pop() as NostrEvent; // +a
    const event2 = await pusher.pop() as NostrEvent; // +b
    const event3 = await pusher.pop() as NostrEvent; // -a

    {
        const err = await config3.addEvent(event2);
        if (err instanceof Error) fail(err.message);
    }
    assertEquals(config3.getPinList(), new Set(["b"]));

    // apply -a before +a
    {
        const err = await config3.addEvent(event3);
        if (err instanceof Error) fail(err.message);
    }
    {
        const err = await config3.addEvent(event1);
        if (err instanceof Error) fail(err.message);
    }
    assertEquals(config3.getPinList(), new Set(["b"]));

    // +a again
    await config.addPin("a");
    assertEquals(config.getPinList(), new Set(["a", "b"]));
    const event4 = await pusher.pop() as NostrEvent;
    {
        const err = await config3.addEvent(event4);
        if (err instanceof Error) fail(err.message);
        assertEquals(config3.getPinList(), new Set(["a", "b"]));
    }
});
