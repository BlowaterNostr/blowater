import { bundle } from "https://deno.land/x/emit@0.31.0/mod.ts";
import { logo } from "./build-pwa.ts";

const exists = async (filename: string): Promise<boolean> => {
    try {
        await Deno.stat(filename);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        } else {
            throw error;
        }
    }
};
const folderName = "build-extension";

if (await exists(folderName)) {
    await Deno.remove(folderName, { recursive: true });
}

await Deno.mkdir(folderName);
const url = new URL("./_main.tsx", import.meta.url);
const res = await bundle(url);
await Deno.writeTextFile(`./${folderName}/main.mjs`, res.code);
await Deno.copyFile("./deploy/alby-logo.svg", `./${folderName}/alby-logo.svg`);
await Deno.copyFile("./deploy/index-extension.html", `./${folderName}/index.html`);
await Deno.copyFile(logo, `./${folderName}/logo.ico`);
await Deno.copyFile(logo, `./${folderName}/logo.png`);
await Deno.copyFile("./deploy/manifest-extension.json", `./${folderName}/manifest.json`);
await Deno.copyFile("./deploy/tailwind.js", `./${folderName}/tailwind.js`);
