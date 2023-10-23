

import { walk } from "https://deno.land/std@0.202.0/fs/walk.ts";

import { bundle } from "https://deno.land/x/emit/mod.ts";
async function findTestFiles(directory: string): string[] {
    const testFiles: string[] = [];
  
    for await (const entry of walk(directory, { exts: [".test.tsx"] })) {
      testFiles.push(entry.path);
    }
  
    return testFiles;
  }

const testFiles = await findTestFiles("./");
const promiseArray = testFiles.map(async (param) => {


    // const command = `deno bundle --config=./deno.json ${param} deploy/main.mjs`;
  
    // // Execute the command asynchronously
    // const process = Deno.run({
    //   cmd: command.split(" "),
    //   stdout: "piped",
    //   stderr: "piped",
    // });
  
    // const { code } = await process.status();
    // const output = new TextDecoder().decode(await process.output());
    // const error = new TextDecoder().decode(await process.stderrOutput());
  
    // console.log(`Command: ${command}`);
    // console.log(`Exit Code: ${code}`);
    // console.log(`Output: ${output}`);
    // console.log(`Error: ${error}`);
    // if (error!=null) {throw(error)}

    // import { bundle } from "https://deno.land/x/emit/mod.ts";
    const result = await bundle(
    new URL(param,import.meta.url),
    );

    const { code } = result;
    console.log(code);
  });


  
await Promise.all(promiseArray);