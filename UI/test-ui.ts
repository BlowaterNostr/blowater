import { walk } from "https://deno.land/std@0.202.0/fs/walk.ts";
import { bundle } from "https://deno.land/x/emit@0.31.0/mod.ts";

async function findTestFiles(directory: string): Promise<string[]> {
    const testFiles: string[] = [];

    for await (const entry of walk(directory, { exts: [".test.tsx"] })) {
        testFiles.push(entry.path);
    }

    return testFiles;
}

const testFiles = await findTestFiles("./");
const promiseArray = testFiles.map(async (param) => {
    const result = await bundle(
        new URL(param, import.meta.url),
    );

    const { code } = result;
    console.log(code);
});

await Promise.all(promiseArray);
