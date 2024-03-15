/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";

let vdom = (
    <div class="border">
        <Editor
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
        />
    </div>
);
render(vdom, document.body);
