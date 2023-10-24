import { walk } from "https://deno.land/std@0.202.0/fs/walk.ts";
import { bundle } from "https://deno.land/x/emit@0.31.0/mod.ts";

for await (const entry of walk("./", { exts: [".test.tsx"] })) {
    const url = new URL(entry.path, import.meta.url);
    console.log("bundling", url.pathname);
    await bundle(url);
}
