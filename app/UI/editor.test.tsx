/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { Editor } from "./editor.tsx";
import { testEventBus } from "./_setup.test.ts";
import { test_db_view } from "./_setup.test.ts";

const database = await test_db_view();

let vdom = (
    <div class="border">
        <Editor
            replyToEventID={`@xxx`}
            placeholder="Message @xxx"
            maxHeight="50vh"
            emit={testEventBus.emit}
            getters={{
                profileGetter: database,
                getEventByID: database.getEventByID,
            }}
        />
    </div>
);
render(vdom, document.body);
