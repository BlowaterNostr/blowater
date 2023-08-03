import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { AsyncWebSocket } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/websocket.ts";
import { PrivateKey, PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    InMemoryAccountContext,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import {
    ConnectionPool,
    NoRelayRegistered,
    SingleRelayConnection,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { getAllDecryptedMessagesOf, sendDMandImages } from "./dm.ts";
import { defaultRelays } from "../UI/setting.ts";

const testPrivateKey = PrivateKey.Generate();
// const myPublicKeyString = Deno.env.get("TEST_NOTIFICATION_PUBKEY");
// if (myPublicKeyString == undefined) {
//     Deno.exit(1);
// }
// const myPublicKey = PublicKey.FromString(myPublicKeyString);
// if (myPublicKey instanceof Error) {
//     Deno.exit(1);
// }

// Deno.test("sendDMandImages", async (t) => {
//     const pool = new ConnectionPool();
//     const ps = [];
//     for (let url of defaultRelays) {
//         console.log(url);
//         const relay = SingleRelayConnection.New(url, AsyncWebSocket.New);
//         if (relay instanceof Error) {
//             fail(relay.message);
//         }
//         const p = pool.addRelay(relay);
//         ps.push(p);
//     }
//     await Promise.all(ps);

//     const path = await Deno.realPath("UI/deploy/logo-white.png");
//     console.log(path);
//     const data = await Deno.readFile(path);

//     await t.step("able to send images only", async () => {
//         const errs = await sendDMandImages({
//             sender: InMemoryAccountContext.New(testPrivateKey),
//             receiverPublicKey: myPublicKey,
//             message: "   ", // will be ignored
//             files: [new Blob([data])],
//             kind: NostrKind.DIRECT_MESSAGE,
//             lamport_timestamp: 0,
//             pool,
//             waitAll: true,
//             tags: [],
//         });
//         if (errs instanceof Error) {
//             fail(errs.message);
//         }
//         if (errs) {
//             if (errs instanceof NoRelayRegistered) {
//                 fail(JSON.stringify(errs));
//             } else {
//                 for (const err of errs) {
//                     if (err && err instanceof NoRelayRegistered) {
//                         fail(JSON.stringify(errs));
//                     }
//                 }
//             }
//         }
//     });

//     await t.step("send image and text", async () => {
//         const errs2 = await sendDMandImages({
//             sender: InMemoryAccountContext.New(testPrivateKey),
//             receiverPublicKey: myPublicKey,
//             message: "send image and text",
//             files: [new Blob([data])],
//             kind: NostrKind.DIRECT_MESSAGE,
//             lamport_timestamp: 0,
//             pool,
//             waitAll: true,
//             tags: [],
//         });
//         if (errs2 instanceof Error) {
//             fail(errs2.message);
//         }
//         if (errs2) {
//             if (errs2 instanceof NoRelayRegistered) {
//                 fail(JSON.stringify(errs2));
//             } else {
//                 for (const err of errs2) {
//                     if (err && err instanceof NoRelayRegistered) {
//                         fail(JSON.stringify(errs2));
//                     }
//                 }
//             }
//         }
//     });

//     await pool.close();
// });

Deno.test("getAllDecryptedMessagesOf", async () => {
    const pool = new ConnectionPool();
    const relay = SingleRelayConnection.New(defaultRelays[0], AsyncWebSocket.New);
    if (relay instanceof Error) {
        fail(relay.message);
    }
    const err = await pool.addRelay(relay);
    if (err instanceof Error) {
        fail(err.message);
    }
    let stream = getAllDecryptedMessagesOf(InMemoryAccountContext.New(testPrivateKey), pool, 3);
    try {
        await stream.next();
        await stream.next();
    } catch (e) {
        console.log(e);
    }
    await pool.close();
});
