import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { prepareCustomAppDataEvent, prepareEncryptedNostrEvent } from "./lib/nostr-ts/event.ts";
import { PrivateKey } from "./lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrEvent, RelayResponse_REQ_Message } from "./lib/nostr-ts/nostr.ts";
import { Channel, closed } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { ConnectionPool } from "./lib/nostr-ts/relay.ts";
import { relays } from "./lib/nostr-ts/relay-list.test.ts";

Deno.test("group chat", async () => {
    const pool = new ConnectionPool();
    const err = await pool.addRelayURL(relays[1]);
    if (err instanceof Error) fail(err.message);
    // user A creates a group X,
    // group X invites user B, with decryption key D
    // group X invites user C, with decryption key D'
    // user B sends to group X
    const ctx_A = InMemoryAccountContext.New(PrivateKey.Generate());
    const ctx_B = InMemoryAccountContext.New(PrivateKey.Generate());
    const ctx_C = InMemoryAccountContext.New(PrivateKey.Generate());
    const ctx_member_created_by_A = InMemoryAccountContext.New(PrivateKey.Generate());

    // User A
    const a = (async () => {
        // Create the group
        const ctx_group = InMemoryAccountContext.New(PrivateKey.Generate());
        const createGroupChatEvent = await prepareCustomAppDataEvent(ctx_A, {
            type: "CreateGroupChat",
            groupAdminKey: ctx_group.privateKey.hex,
            groupMemberKey: ctx_member_created_by_A.privateKey.hex,
        });
        if (createGroupChatEvent instanceof Error) fail(createGroupChatEvent.message);

        // Invite B
        {
            const groupInviationEvent = await prepareEncryptedNostrEvent(ctx_group, ctx_B.publicKey, 4, [
                ["p", ctx_B.publicKey.hex],
            ], `${ctx_member_created_by_A.privateKey.bech32}`);
            if (groupInviationEvent instanceof Error) fail(groupInviationEvent.message);
            const err = await pool.sendEvent(groupInviationEvent);
            if (err instanceof Error) fail(err.message);
        }

        // Send Message to Group
        {
            const groupMsg = await prepareEncryptedNostrEvent(ctx_A, ctx_member_created_by_A.publicKey, 4, [
                ["p", ctx_member_created_by_A.publicKey.hex],
            ], "hi all");
            if (groupMsg instanceof Error) fail(groupMsg.message);
            const err = await pool.sendEvent(groupMsg);
            if (err instanceof Error) fail(err.message);
        }
    })();

    // User B
    const b = (async () => {
        // receive the invitation
        const stream = await pool.newSub("b", { "#p": [ctx_B.publicKey.hex] });
        if (stream instanceof Error) fail(stream.message);

        const invitationEvent = await next(stream.chan);
        const invitation = await ctx_B.decrypt(invitationEvent.pubkey, invitationEvent.content);
        if (invitation instanceof Error) fail(invitation.message);

        console.log("group member private key:", invitation);
        const ctx_member_received_by_B = InMemoryAccountContext.New(
            PrivateKey.FromString(invitation) as PrivateKey,
        );
        assertEquals(ctx_member_received_by_B.privateKey.hex, ctx_member_created_by_A.privateKey.hex);

        // receives from group
        {
            const stream_group = await pool.newSub("b receives from group", {
                "#p": [ctx_member_created_by_A.publicKey.hex],
            });
            if (stream_group instanceof Error) fail(stream_group.message);

            const groupMsg = await next(stream_group.chan);
            const content = await ctx_member_created_by_A.decrypt(groupMsg.pubkey, groupMsg.content);
            if (content instanceof Error) fail(content.message);
            assertEquals(content, "hi all");
        }
    })();

    // User C
    const c = (async () => {
    })();

    await Promise.all([a, b, c]);
    await pool.close();
});

async function next(
    chan: Channel<{
        res: RelayResponse_REQ_Message;
        url: string;
    }>,
) {
    for await (const msg of chan) {
        if (msg.res.type == "EOSE") {
            continue;
        }
        return msg.res.event;
    }
    fail();
}
