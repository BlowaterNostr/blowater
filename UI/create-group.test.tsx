/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { CreateGroup } from "./create-group.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <CreateGroup
        emit={testEventBus.emit}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
