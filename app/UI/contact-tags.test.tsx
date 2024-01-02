/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ContactTags } from "./contact-tags.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <ContactTags
        tags={["contacts", "strangers"]}
        emit={testEventBus.emit}
    />,
    document.body,
);
