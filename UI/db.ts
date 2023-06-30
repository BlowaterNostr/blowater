import * as dexie from "https://unpkg.com/dexie@3.2.3/dist/modern/dexie.mjs";
import { Database, Indices } from "../database.ts";
import { NostrEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

export class Events extends dexie.Dexie {
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

export async function NewIndexedDB(): Promise<Database | Error> {
    try {
        const db = new Events();
        const cache: NostrEvent[] = await db.events.filter((_: any) => true).toArray();

        return new Database(
            async (event: NostrEvent) => {
                await db.events.put(event);
                cache.push(event);
            },
            async (keys: Indices) => {
                return db.events.get(keys);
            },
            (filter: (e: NostrEvent) => boolean) => {
                return cache.filter(filter);
            },
        );
    } catch (e) {
        return e;
    }
}
