import { bundle } from "https://deno.land/x/emit@0.31.0/mod.ts";

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
const folderName = "build-pwa";

if (await exists(folderName)) {
    await Deno.remove(folderName, { recursive: true });
}

await Deno.mkdir(folderName);
const url = new URL("./_main.tsx", import.meta.url);
const res = await bundle(url);
await Deno.writeTextFile(`./${folderName}/main.mjs`, res.code);
await Deno.copyFile("./deploy/alby-logo.svg", `./${folderName}/alby-logo.svg`);
await Deno.copyFile("./deploy/index.html", `./${folderName}/index.html`);
await Deno.copyFile("./deploy/logo-white.png", `./${folderName}/logo-white.png`);
await Deno.copyFile("./deploy/logo.ico", `./${folderName}/logo.ico`);
await Deno.copyFile("./deploy/logo.png", `./${folderName}/logo.png`);
await Deno.copyFile("./deploy/manifest.json", `./${folderName}/manifest.json`);
