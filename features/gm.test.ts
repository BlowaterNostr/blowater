import {
    assertEquals,
    assertIsError,
    assertNotEquals,
    fail,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { GroupMessageController } from "./gm.ts";
import { getTags } from "../nostr.ts";

Deno.test("group chat", async () => {
    const user_A = InMemoryAccountContext.Generate();
    const user_B = InMemoryAccountContext.Generate();
    const user_C = InMemoryAccountContext.Generate();

    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
    const gm_B = new GroupMessageController(user_B, { add: (_) => {} }, { add: (_) => {} });
    const gm_C = new GroupMessageController(user_C, { add: (_) => {} }, { add: (_) => {} });

    const group_chat = gm_A.createGroupChat();
    {
        const event = await gm_A.encodeCreationToNostrEvent(group_chat);
        if (event instanceof Error) fail(event.message);
        await gm_A.addEvent({
            ...event,
            parsedTags: getTags(event),
            publicKey: PublicKey.FromHex(event.pubkey) as PublicKey,
        });

        const gm_admin_ctx = gm_A.getGroupAdminCtx(group_chat.groupKey.publicKey);
        assertEquals(gm_admin_ctx, group_chat.groupKey);
    }

    const invite_B = await gm_A.createInvitation(group_chat.groupKey.publicKey, user_B.publicKey);
    if (invite_B instanceof Error) fail(invite_B.message);
    {
        const invite_C = await gm_A.createInvitation(group_chat.groupKey.publicKey, user_C.publicKey);
        if (invite_C instanceof Error) fail(invite_C.message);

        await gm_B.addEvent({
            ...invite_B,
            parsedTags: getTags(invite_B),
            publicKey: PublicKey.FromHex(invite_B.pubkey) as PublicKey,
        });

        await gm_C.addEvent({
            ...invite_C,
            parsedTags: getTags(invite_C),
            publicKey: PublicKey.FromHex(invite_C.pubkey) as PublicKey,
        });

        const gm_ctx_A = gm_A.getGroupChatCtx(group_chat.groupKey.publicKey);
        const gm_ctx_B = gm_B.getGroupChatCtx(group_chat.groupKey.publicKey);
        const gm_ctx_C = gm_C.getGroupChatCtx(group_chat.groupKey.publicKey);
        assertEquals(gm_ctx_A, gm_ctx_B);
        assertEquals(gm_ctx_A, gm_ctx_C);
        assertNotEquals(gm_ctx_A, undefined);
    }
    {
        // wrong invite
        const err = await gm_A.addEvent({
            ...invite_B,
            parsedTags: getTags(invite_B),
            publicKey: PublicKey.FromHex(invite_B.pubkey) as PublicKey,
        });
        assertIsError(err);
    }

    const list = gm_A.getConversationList();
    assertEquals(list, [{
        pubkey: group_chat.groupKey.publicKey,
    }]);
    assertEquals(gm_B.getConversationList(), [{
        pubkey: group_chat.groupKey.publicKey,
    }]);
});

Deno.test("should be only one group if the group created by me and invited me", () => {
    const user_A = InMemoryAccountContext.Generate();
    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });

    const gm_creation = gm_A.createGroupChat();
    gm_A.invitations.set(gm_creation.groupKey.publicKey.bech32(), {
        cipherKey: gm_creation.cipherKey,
        groupAddr: gm_creation.groupKey.publicKey
    });

    assertEquals(gm_A.getConversationList().length, 1);
    assertEquals(gm_A.getConversationList()[0].pubkey.bech32(), gm_creation.groupKey.publicKey.bech32());
});
