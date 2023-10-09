import { assertEquals, fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Channel, closed } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent } from "../lib/nostr-ts/event.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, RelayResponse_REQ_Message } from "../lib/nostr-ts/nostr.ts";
import { relays } from "../lib/nostr-ts/relay-list.test.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { parseJSON } from "./profile.ts";

Deno.test("group chat", async () => {
    const pool = new ConnectionPool();
    const err = await pool.addRelayURL(relays[1]);
    if (err instanceof Error) fail(err.message);
    // user A creates a group X,
    // group X invites user B, with decryption key D
    // group X invites user C, with decryption key D'
    // user B sends to group X
    const key_A = PrivateKey.Generate();
    const key_B = PrivateKey.Generate();
    const key_C = PrivateKey.Generate();
    const group_decrypt_key = PrivateKey.Generate();
    const group_key = PrivateKey.Generate().toPublicKey();

    // User A
    const a = (async () => {
        const ctx_A = InMemoryAccountContext.New(key_A);
        // Create the group
        // const ctx_group = InMemoryAccountContext.New(group_key);
        const group_decrypt_ctx_created_by_A = InMemoryAccountContext.New(group_decrypt_key);
        // const createGroupChatEvent = await prepareCustomAppDataEvent(ctx_A, {
        //     type: "CreateGroupChat",
        //     groupAdminKey: ctx_group.privateKey.hex,
        //     groupMemberKey: ctx_member_created_by_A.privateKey.hex,
        // });
        // if (createGroupChatEvent instanceof Error) fail(createGroupChatEvent.message);

        // Invite B
        {
            const groupInviationEvent = await prepareEncryptedNostrEvent(
                ctx_A,
                {
                    encryptKey: key_B.toPublicKey(),
                    kind: 4,
                    tags: [
                        ["p", key_B.toPublicKey().hex],
                    ],
                    content: JSON.stringify({
                        decrypt_key: group_decrypt_ctx_created_by_A.privateKey.bech32,
                        public_key: group_key.bech32(),
                    }),
                },
            );
            if (groupInviationEvent instanceof Error) fail(groupInviationEvent.message);
            const err = await pool.sendEvent(groupInviationEvent);
            if (err instanceof Error) fail(err.message);
        }

        // Send Message to Group
        {
            const groupMsg = await prepareEncryptedNostrEvent(
                ctx_A,
                {
                    encryptKey: group_decrypt_ctx_created_by_A.publicKey,
                    kind: 4,
                    tags: [
                        ["p", group_key.hex],
                    ],
                    content: "hi all, this is A",
                },
            );
            if (groupMsg instanceof Error) fail(groupMsg.message);
            const err = await pool.sendEvent(groupMsg);
            if (err instanceof Error) fail(err.message);
        }

        // receive from Group
        const stream_group = await pool.newSub("a receives from group", {
            "#p": [group_key.hex],
        });
        if (stream_group instanceof Error) fail(stream_group.message);
        {
            {
                const groupMsg_1 = await next(stream_group.chan);
                assertEquals(groupMsg_1.pubkey, ctx_A.publicKey.hex); // from self
            }

            {
                const groupMsg_2 = await next(stream_group.chan);
                assertEquals(groupMsg_2.pubkey, key_B.toPublicKey().hex); // from B
                const content_2 = await group_decrypt_ctx_created_by_A.decrypt(
                    groupMsg_2.pubkey,
                    groupMsg_2.content,
                );
                if (content_2 instanceof Error) fail(content_2.message);
                assertEquals(content_2, "hi all, this is B");
            }

            // invite C
            {
                const groupInviationEvent = await prepareEncryptedNostrEvent(
                    ctx_A,
                    {
                        encryptKey: key_C.toPublicKey(),

                        kind: 4,
                        tags: [
                            ["p", key_C.toPublicKey().hex],
                        ],
                        content: JSON.stringify({
                            decrypt_key: group_decrypt_ctx_created_by_A.privateKey.bech32,
                            public_key: group_key.bech32(),
                        }),
                    },
                );
                if (groupInviationEvent instanceof Error) fail(groupInviationEvent.message);
                const err = await pool.sendEvent(groupInviationEvent);
                if (err instanceof Error) fail(err.message);
            }
        }
    })();

    // User B
    const b = (async () => {
        const ctx_B = InMemoryAccountContext.New(key_B);
        // receive the invitation
        const stream = await pool.newSub("b", { "#p": [ctx_B.publicKey.hex] });
        if (stream instanceof Error) fail(stream.message);

        const invitationEvent = await next(stream.chan);
        const invitation = await ctx_B.decrypt(invitationEvent.pubkey, invitationEvent.content);
        if (invitation instanceof Error) fail(invitation.message);
        const decrypt_key = parseJSON<any>(invitation).decrypt_key;

        console.log("group member private key:", invitation);
        const ctx_decrypt_received_by_B = InMemoryAccountContext.New(
            PrivateKey.FromString(decrypt_key) as PrivateKey,
        );
        assertEquals(ctx_decrypt_received_by_B.privateKey.hex, group_decrypt_key.hex);

        const stream_group = await pool.newSub("b receives from group", {
            "#p": [group_key.hex],
        });
        if (stream_group instanceof Error) fail(stream_group.message);

        // receives from A
        {
            const groupMsg = await next(stream_group.chan);
            assertEquals(groupMsg.pubkey, key_A.toPublicKey().hex); // make sure the event is from A
            const content = await ctx_decrypt_received_by_B.decrypt(
                groupMsg.pubkey,
                groupMsg.content,
            );
            if (content instanceof Error) fail(content.message);
            assertEquals(content, "hi all, this is A");
        }

        // send to group
        {
            const groupMsg = await prepareEncryptedNostrEvent(ctx_B, {
                encryptKey: ctx_decrypt_received_by_B.publicKey,
                kind: 4,
                tags: [
                    ["p", group_key.hex],
                ],
                content: "hi all, this is B",
            });
            if (groupMsg instanceof Error) fail(groupMsg.message);
            const err = await pool.sendEvent(groupMsg);
            if (err instanceof Error) fail(err.message);
        }

        // receive from self
        {
            const groupMsg_2 = await next(stream_group.chan);
            assertEquals(groupMsg_2.pubkey, key_B.toPublicKey().hex); // make sure the event is from B
            const content_2 = await ctx_decrypt_received_by_B.decrypt(
                groupMsg_2.pubkey,
                groupMsg_2.content,
            );
            if (content_2 instanceof Error) fail(content_2.message);
            assertEquals(content_2, "hi all, this is B");
        }
    })();

    // User C
    const c = (async () => {
        const ctx_C = InMemoryAccountContext.New(key_C);
        // receive the invitation
        {
            const stream = await pool.newSub("c", { "#p": [ctx_C.publicKey.hex] });
            if (stream instanceof Error) fail(stream.message);

            const invitationEvent = await next(stream.chan);
            const invitation = await ctx_C.decrypt(invitationEvent.pubkey, invitationEvent.content);
            if (invitation instanceof Error) fail(invitation.message);
            const decrypt_key = parseJSON<any>(invitation).decrypt_key;

            const group_decrypt_ctx_received_by_C = InMemoryAccountContext.New(
                PrivateKey.FromString(decrypt_key) as PrivateKey,
            );
            assertEquals(group_decrypt_ctx_received_by_C.privateKey.hex, group_decrypt_key.hex);

            // receives from group
            const stream_group = await pool.newSub("c receives from group", {
                "#p": [group_key.hex],
            });
            if (stream_group instanceof Error) fail(stream_group.message);
            {
                // from A
                {
                    const groupMsg = await next(stream_group.chan);
                    assertEquals(groupMsg.pubkey, key_A.toPublicKey().hex); // make sure the event is from A
                    const content = await group_decrypt_ctx_received_by_C.decrypt(
                        groupMsg.pubkey,
                        groupMsg.content,
                    );
                    if (content instanceof Error) fail(content.message);
                    assertEquals(content, "hi all, this is A");
                }

                // from B
                {
                    const groupMsg_2 = await next(stream_group.chan);
                    assertEquals(groupMsg_2.pubkey, key_B.toPublicKey().hex); // make sure the event is from B
                    const content_2 = await group_decrypt_ctx_received_by_C.decrypt(
                        groupMsg_2.pubkey,
                        groupMsg_2.content,
                    );
                    if (content_2 instanceof Error) fail(content_2.message);
                    assertEquals(content_2, "hi all, this is B");
                }
            }

            // send to group
            {
                const groupMsg = await prepareEncryptedNostrEvent(
                    ctx_C,
                    {
                        encryptKey: group_decrypt_ctx_received_by_C.publicKey,
                        kind: 4,
                        tags: [
                            ["p", group_key.hex],
                        ],
                        content: "hi all, this is C",
                    },
                );
                if (groupMsg instanceof Error) fail(groupMsg.message);
                const err = await pool.sendEvent(groupMsg);
                if (err instanceof Error) fail(err.message);
            }

            // from C
            {
                const groupMsg = await next(stream_group.chan);
                assertEquals(groupMsg.pubkey, key_C.toPublicKey().hex); // make sure the event is from A
                const content = await group_decrypt_ctx_received_by_C.decrypt(
                    groupMsg.pubkey,
                    groupMsg.content,
                );
                if (content instanceof Error) fail(content.message);
                assertEquals(content, "hi all, this is C");
            }
        }
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
