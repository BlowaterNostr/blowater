import { walk } from "https://deno.land/std@0.202.0/fs/walk.ts";
import * as emit from "https://deno.land/x/emit@0.32.0/mod.ts";

for await (const entry of walk("./", { exts: [".test.tsx"] })) {
    console.log("compiling", entry.path);
    await emit.transpile(entry.path);
}
