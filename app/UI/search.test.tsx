import { h, render } from "preact";
import { Search } from "./search.tsx";
import { testEventBus } from "./_setup.test.ts";
import { DexieDatabase, NewIndexedDB } from "./dexie-db.ts";
import { Database_View } from "../database.ts";

const indexed_db = NewIndexedDB() as DexieDatabase;

render(
    <Search
        profileGetter={await Database_View.New(indexed_db, indexed_db, indexed_db)}
        emit={testEventBus.emit}
        placeholder="search"
    />,
    document.body,
);
