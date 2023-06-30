import { DB } from "https://deno.land/x/sqlite@v3.7.2/mod.ts";
import { NostrKind } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";

// Open a database
const db = new DB("stats.sqlite");
db.execute(`
  CREATE TABLE IF NOT EXISTS stats (
    pubkey TEXT,
    eventID TEXT,
    PRIMARY KEY (pubkey, eventID)
  )
`);

// const relay = SingleRelayConnection.New("wss://relay.damus.io", AsyncWebSocket.New);

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

const set = new Set();
let i = 0;
for await (const [e, url] of r) {
    console.log(url);
    if (e[0] != "EVENT") {
        continue;
    }
    // console.log(e);
    const pub = e[2].pubkey;
    const index = [pub, e[2].id];
    try {
        db.query("INSERT INTO stats (pubkey, eventID) VALUES (?, ?)", [pub, e[2].id]);
    } catch (e) {}
}

// const query2: SQL = "SELECT C From X"
