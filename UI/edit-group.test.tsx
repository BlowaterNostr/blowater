/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { testEventBus } from "./_setup.test.ts";
import { EditGroup } from "./edit-group.tsx";

render(
    <EditGroup
        emit={testEventBus.emit}
        profileData={{
            name: "afdsafd",
            picture: "Adsfsafd",
        }}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
