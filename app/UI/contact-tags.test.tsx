/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { ContactTags } from "./contact-tags.tsx";

render(
    <ContactTags
        tags={["contacts", "strangers"]}
    />,
    document.body,
);
