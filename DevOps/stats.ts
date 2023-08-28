import { DB } from "https://deno.land/x/sqlite@v3.7.2/mod.ts";
import { NostrKind } from "../lib/nostr.ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr.ts/relay.ts";

// Open a database
const db = new DB("stats.sqlite");
db.execute(`
  CREATE TABLE IF NOT EXISTS stats (
    pubkey TEXT,
    eventID TEXT,
    PRIMARY KEY (pubkey, eventID)
  )
`);

const pool = new ConnectionPool();
const urls = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://eden.nostr.land",
    "wss://brb.io",
    "wss://sg.qemura.xyz",
    "wss://nostr-sg.com",
    "wss://nostr-pub.wellorder.net",
    "wss://relay.snort.social",
    "wss://offchain.pub",
];
for (const url of urls) {
    pool.addRelayURL(url);
}

const r = await pool.newSub("stats", {
    kinds: [NostrKind.CustomAppData],
});
if (r instanceof Error) {
    throw r;
}

for await (const { res: e, url } of r) {
    console.log(url);
    if (e.type != "EVENT") {
        continue;
    }

    const pub = e.event.pubkey;
    try {
        db.query("INSERT INTO stats (pubkey, eventID) VALUES (?, ?)", [pub, e.event.id]);
    } catch (e) {
        console.log(e.message);
    }
}
