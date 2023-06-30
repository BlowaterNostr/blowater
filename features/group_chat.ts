/*

Nostr support public group chat in https://github.com/nostr-protocol/nips/blob/master/28.md
It's globally public therefore no encryption

This module experiments with an encrypted private group chat

Basic design:
A, B, C are 3 users who want to chat together.
A sends a DM to [B, C] with a special marker in the content to signal the client
that this is a group chat.

content: {
    message: string

    ,
    group_chat_id: string
}

*/
