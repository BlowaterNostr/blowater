/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RelayDetail } from "./relay-detail.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Datebase_View } from "../database.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { testEventBus } from "./_setup.test.ts";

const db = NewIndexedDB();
if (db instanceof Error) {
    fail(db.message);
}
const database = await Datebase_View.New(db, db, db);

render(<RelayDetail relayUrl="wss://relay.damus.io" profileGetter={database} emit={testEventBus.emit} />, document.body);


for await (const event of testEventBus.onChange()) {
    console.log(event);
}
