/** @jsx h */
import { h, render } from "preact";
import { RelayInformationComponent } from "./relay-detail.tsx";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Database_View } from "../database.ts";
import { NewIndexedDB } from "./dexie-db.ts";
import { testEventBus } from "./_setup.test.ts";

const db = NewIndexedDB();
if (db instanceof Error) {
    fail(db.message);
}
const database = await Database_View.New(db, db, db);

render(
    <RelayInformationComponent relayUrl="wss://yabu.me" profileGetter={database} emit={testEventBus.emit} />,
    document.body,
);
