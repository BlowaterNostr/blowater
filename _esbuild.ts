import * as esbuild from "npm:esbuild@0.20.2";
import * as loader from "jsr:@luca/esbuild-deno-loader@^0.10.3";
import { join } from "@std/path";

const result = await esbuild.build({
    plugins: [...loader.denoPlugins({
        loader: "native",
        configPath: join(Deno.cwd(), "deno.json"),
    })],
    jsxFactory: "h",
    jsxFragment: "Fragment",
    entryPoints: ["./app/UI/_main.tsx"],
    outfile: "app/UI/assets/main.mjs",
    bundle: true,
    format: "esm",
});
console.log(result);
esbuild.stop();
