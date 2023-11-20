import {
    assertEquals,
    assertNotEquals,
    assertNotInstanceOf,
    fail,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { blobToBase64, InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { gmEventType, GroupMessageController } from "./gm.ts";
import { getTags } from "../nostr.ts";
import { DirectedMessageController } from "./dm.ts";

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
        const err = await gm_A.addEvent({
            ...invite_B,
            parsedTags: getTags(invite_B),
            publicKey: PublicKey.FromHex(invite_B.pubkey) as PublicKey,
        });
        assertEquals(err, undefined);
    }

    const list = gm_A.getConversationList();
    assertEquals(list, [{
        pubkey: group_chat.groupKey.publicKey,
    }]);
    assertEquals(gm_B.getConversationList(), [{
        pubkey: group_chat.groupKey.publicKey,
    }]);
});

Deno.test("There should only be one group if the group is created by me and inviting myself.", async () => {
    const user_A = InMemoryAccountContext.Generate();
    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });

    const gmCreation = gm_A.createGroupChat();
    assertEquals(gm_A.getConversationList().length, 1);
    assertEquals(gm_A.getConversationList()[0].pubkey, gmCreation.groupKey.publicKey);
    {
        // invite myself
        const invitationEvent = await gm_A.createInvitation(gmCreation.groupKey.publicKey, user_A.publicKey);
        if (invitationEvent instanceof Error) {
            fail(invitationEvent.message);
        }

        await gm_A.addEvent({
            ...invitationEvent,
            parsedTags: getTags(invitationEvent),
            publicKey: PublicKey.FromHex(invitationEvent.pubkey) as PublicKey,
        });

        assertEquals(gm_A.getConversationList().length, 1);
        assertEquals(gm_A.getConversationList()[0].pubkey, gmCreation.groupKey.publicKey);
    }
});

Deno.test("test invitation that I sent", async () => {
    const user_A = InMemoryAccountContext.Generate();
    const user_B = InMemoryAccountContext.Generate();
    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
    const dm_A = new DirectedMessageController(user_A);

    // user_A created a group and invite user_B
    const gm_A_Creation = gm_A.createGroupChat();
    const invite_user_B = await gm_A.createInvitation(gm_A_Creation.groupKey.publicKey, user_B.publicKey);
    if (invite_user_B instanceof Error) {
        fail(invite_user_B.message);
    }
    // should not add this invitation event into gm_A
    {
        const gm_A_addEvent_res = await gm_A.addEvent({
            ...invite_user_B,
            parsedTags: getTags(invite_user_B),
            publicKey: PublicKey.FromHex(invite_user_B.pubkey) as PublicKey,
        });
        assertEquals(gm_A_addEvent_res, undefined);
    }
    // should add this invitation event into dm_A
    {
        const parsedEvent = {
            ...invite_user_B,
            parsedTags: getTags(invite_user_B),
            publicKey: PublicKey.FromHex(invite_user_B.pubkey) as PublicKey,
        };
        const dm_A_addEvent_res = await dm_A.addEvent(parsedEvent);
        assertNotInstanceOf(dm_A_addEvent_res, Error);

        const messages = dm_A.getChatMessages(user_B.publicKey.hex);
        assertEquals(messages.length, 1);
        assertEquals(messages[0].event, parsedEvent);
    }
});

Deno.test("should get the correct gm type", async () => {
    const user_A = InMemoryAccountContext.Generate();
    const user_B = InMemoryAccountContext.Generate();
    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
    const gm_B = new GroupMessageController(user_B, { add: (_) => {} }, { add: (_) => {} });
    const creation = gm_A.createGroupChat();
    {
        // message
        const messageEvent = await gm_A.prepareGroupMessageEvent(creation.groupKey.publicKey, "hello");
        if (messageEvent instanceof Error) {
            fail(messageEvent.message);
        }
        assertEquals(await gmEventType(user_A, messageEvent), "gm_message");
    }

    {
        // invitation
        const invitationEvent = await gm_A.createInvitation(creation.groupKey.publicKey, user_A.publicKey);
        if (invitationEvent instanceof Error) {
            fail(invitationEvent.message);
        }

        assertEquals(await gmEventType(user_A, invitationEvent), "gm_invitation");
    }

    {
        // creation
        const creationEvent = await gm_A.encodeCreationToNostrEvent(gm_A.createGroupChat());
        if (creationEvent instanceof Error) {
            fail(creationEvent.message);
        }

        assertEquals(await gmEventType(user_A, creationEvent), "gm_creation");
    }

    {
        // receive messages from others
        const invitation_B = await gm_A.createInvitation(creation.groupKey.publicKey, user_B.publicKey);
        if (invitation_B instanceof Error) {
            fail(invitation_B.message);
        }
        await gm_B.addEvent({
            ...invitation_B,
            parsedTags: getTags(invitation_B),
            publicKey: PublicKey.FromHex(invitation_B.pubkey) as PublicKey,
        });
        const messageEvent = await gm_B.prepareGroupMessageEvent(creation.groupKey.publicKey, "hi");
        if (messageEvent instanceof Error) {
            fail(messageEvent.message);
        }
        assertEquals(await gmEventType(user_A, messageEvent), "gm_message");
    }
});

Deno.test("need to add group before handling relevant messages", async () => {
    const user_A = InMemoryAccountContext.Generate();
    const user_B = InMemoryAccountContext.Generate();
    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
    const gm_B = new GroupMessageController(user_B, { add: (_) => {} }, { add: (_) => {} });

    const groupChat = gm_A.createGroupChat();

    {
        const message = await gm_A.prepareGroupMessageEvent(groupChat.groupKey.publicKey, "hi");
        if (message instanceof Error) fail(message.message);

        // will get an error because the group chat is not added to user B yet
        const err = await gm_B.addEvent({
            ...message,
            parsedTags: getTags(message),
            publicKey: user_A.publicKey,
        });
        assertEquals(err?.message, `group ${groupChat.groupKey.publicKey.hex} does not have me in it`);
    }
    {
        // now, invite user B to group first, then send the message
        {
            const invite = await gm_A.createInvitation(groupChat.groupKey.publicKey, user_B.publicKey);
            if (invite instanceof Error) fail(invite.message);
            const err = await gm_B.addEvent({
                ...invite,
                parsedTags: getTags(invite),
                publicKey: user_A.publicKey,
            });
            assertEquals(err, undefined);
        }
        {
            const message = await gm_A.prepareGroupMessageEvent(groupChat.groupKey.publicKey, "hi");
            if (message instanceof Error) fail(message.message);
            // will get an error because the group chat is not added to user B yet
            const err = await gm_B.addEvent({
                ...message,
                parsedTags: getTags(message),
                publicKey: user_A.publicKey,
            });
            assertEquals(err, undefined); // no error before the invitation has been added before this message
        }
    }
});

Deno.test("should be able to handle the correct message type", async () => {
    const user_A = InMemoryAccountContext.Generate();
    const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
    const groupChat = gm_A.createGroupChat();

    {
        // blob
        const blob = new Blob();
        const blobMessageEvent = await gm_A.prepareGroupMessageEvent(groupChat.groupKey.publicKey, blob);
        if (blobMessageEvent instanceof Error) fail(blobMessageEvent.message);
        await gm_A.addEvent({
            ...blobMessageEvent,
            parsedTags: getTags(blobMessageEvent),
            publicKey: PublicKey.FromHex(blobMessageEvent.pubkey) as PublicKey,
        });

        const message = gm_A.getChatMessages(groupChat.groupKey.publicKey.hex);
        assertEquals(message.length, 1);
        assertEquals(message[0].type, "image");
        assertEquals(message[0].content, await blobToBase64(blob));
    }

    {
        // text
        const textMessageEvent = await gm_A.prepareGroupMessageEvent(groupChat.groupKey.publicKey, "hi");
        if (textMessageEvent instanceof Error) fail(textMessageEvent.message);
        await gm_A.addEvent({
            ...textMessageEvent,
            parsedTags: getTags(textMessageEvent),
            publicKey: PublicKey.FromHex(textMessageEvent.pubkey) as PublicKey,
        });

        const message = gm_A.getChatMessages(groupChat.groupKey.publicKey.hex);
        assertEquals(message.length, 2);
        assertEquals(message[1].type, "text");
        assertEquals(message[1].content, "hi");
    }
});
