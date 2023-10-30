import { bundle } from "https://deno.land/x/emit@0.31.0/mod.ts";

const url = new URL("./_main.tsx", import.meta.url);
const res = await bundle(url);
await Deno.writeTextFile("./deploy-extension/main.mjs", res.code);
