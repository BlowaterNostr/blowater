/** @jsx h */
import { h, render } from "preact";
import { ContactTags } from "./contact-tags.tsx";
import { testEventBus } from "./_setup.test.ts";

render(
    <ContactTags
        tags={["contacts", "strangers"]}
        emit={testEventBus.emit}
    />,
    document.body,
);
