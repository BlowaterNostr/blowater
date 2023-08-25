/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";
import { setup } from "https://esm.sh/twind@0.16.16";
import { NewIndexedDB } from "./dexie-db.ts";
import { Start } from "./app.tsx";

setup({
    theme: {
        fontFamily: {
            roboto: ["Roboto", "sans-serif"],
        },
        screens: {
            "mobile": { "max": "1023px" },
            "desktop": { "min": "1024px" },
        },
    },
    variants: {
        "children": "& > *",
        "firstChild": "& > *:first-child",
        "lastChild": "& > *:last-child",
    },
});

const database = NewIndexedDB();
if (database instanceof Error) {
    console.error(database);
    render(
        <div>
            <p>IndexedDB is not supported in this mode on {navigator.userAgent}</p>
            <p>To ensure a great experience, please use Chromium based browsers</p>
        </div>,
        document.body,
    );
} else {
    Start(database);
}
