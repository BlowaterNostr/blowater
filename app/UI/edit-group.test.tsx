import { h, render } from "https://esm.sh/preact@10.17.1";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { EditGroup } from "./edit-group.tsx";

const database = await test_db_view();

const ctx = InMemoryAccountContext.Generate();

render(
    <EditGroup
        emit={testEventBus.emit}
        ctx={ctx}
        profileGetter={database}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
