import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { testEventsAdapter, testRelayAdapter } from "../UI/_setup.test.ts";
import { Datebase_View } from "../database.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { getAllEncryptedMessagesOf } from "./dm.ts";

const ctx = InMemoryAccountContext.New(
    PrivateKey.FromString("nsec16209kk73kp23e9huu08kd8af7jkw6t3uvvqdwzf3ez8c3yv8xf8srud5h5") as PrivateKey,
);
const pool = new ConnectionPool();
pool.addRelayURLs(relays);
const database = await Datebase_View.New(testEventsAdapter, testRelayAdapter);

const messageStream = getAllEncryptedMessagesOf(
    ctx.publicKey,
    pool,
);

(async () => {
    for await (const msg of messageStream) {
        if (msg.res.type == "EVENT") {
            const err = await database.addEvent(msg.res.event, msg.url);
            if (err instanceof Error) {
                console.log(err);
            }
        }
    }
})();
