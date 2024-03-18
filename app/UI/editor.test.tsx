/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";

let vdom = (
    <div class="h-screen w-screen bg-[#313338] flex justify-center items-center">
        <Editor
            mode={{ type: "reply" }}
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
        />
    </div>
);
render(vdom, document.body);
