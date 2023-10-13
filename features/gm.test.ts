import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Channel, closed } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, RelayResponse_REQ_Message } from "../lib/nostr-ts/nostr.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { parseJSON } from "./profile.ts";
import { GroupMessageController } from "./gm.ts";

Deno.test("group chat", async () => {
    const user_A = InMemoryAccountContext.Generate()
    const user_B = InMemoryAccountContext.Generate()
    const user_C = InMemoryAccountContext.Generate()

    const gm_A = new GroupMessageController(user_A, {add: _=>{}}, {add: _=>{}})
    const gm_B = new GroupMessageController(user_B, {add: _=>{}}, {add: _=>{}})
    const gm_C = new GroupMessageController(user_C, {add: _=>{}}, {add: _=>{}})

    const group_chat = gm_A.createGroupChat()
    const invite_B = await gm_A.createInvitation(group_chat.groupKey.publicKey, user_B.publicKey)
    if(invite_B instanceof Error) fail(invite_B.message)

    const invite_C = await gm_A.createInvitation(group_chat.groupKey.publicKey, user_C.publicKey)
    if(invite_C instanceof Error) fail(invite_C.message)

    gm_B.addEvent()
});

async function next(
    chan: Channel<{
        res: RelayResponse_REQ_Message;
        url: string;
    }>,
) {
    while (true) {
        const msg = await chan.pop();
        if (msg == closed) {
            fail();
        }
        console.log(msg);
        if (msg.res.type == "EOSE") {
            continue;
        }
        return msg.res.event;
    }
    fail();
}
