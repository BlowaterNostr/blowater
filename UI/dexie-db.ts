import * as dexie from "https://unpkg.com/dexie@3.2.3/dist/modern/dexie.mjs";
import { NostrEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

export class DexieDatabase extends dexie.Dexie {
    // 'friends' is added by dexie when declaring the stores()
    // We just tell the typing system this is the case
    // @ts-ignore
    events!: dexie.Table<NostrEvent>;

    constructor() {
        super("Events");
        this.version(6).stores({
            events: "&id, created_at, kind, tags, pubkey", // indices
        });
    }
}

export function NewIndexedDB(): DexieDatabase | Error {
    try {
        const db = new DexieDatabase();
        return db;
    } catch (e) {
        return e;
    }
}
