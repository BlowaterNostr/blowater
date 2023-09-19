/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { CreateGroup } from "./create-group.tsx";

render(
    <CreateGroup
        onCreate={(output) => {
            console.log(output);
        }}
    />,
    document.body,
);
