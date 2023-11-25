import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { OtherConfig } from "./config-other.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";

Deno.test("Pin List", async () => {
    const ctx = InMemoryAccountContext.Generate();
    const config = OtherConfig.Empty();

    config.addPin("a");
    assertEquals(config.getPinList(), new Set(["a"]));

    config.addPin("b");
    assertEquals(config.getPinList(), new Set(["a", "b"]));

    const err = await config.saveToLocalStorage(ctx);
    if (err instanceof Error) fail(err.message);

    const config2 = await OtherConfig.FromLocalStorage(ctx);
    assertEquals(config2.getPinList(), new Set(["a", "b"]));
    assertEquals(config2.getPinList(), config.getPinList());
});
