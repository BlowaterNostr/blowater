import { DB } from "https://deno.land/x/sqlite@v3.7.2/mod.ts";

const query = `SELECT DISTINCT(pubkey) From stats`;

const db = new DB("stats.sqlite");
const res = db.query(query);
for (const row of res) {
    console.log(row);
}
console.log(res.length, "keys");
