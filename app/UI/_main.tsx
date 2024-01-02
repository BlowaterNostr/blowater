/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { NewIndexedDB } from "./dexie-db.ts";
import { Start } from "./app.tsx";

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
