import { ChatMessage } from "../UI/message.ts";
import { Database_Contextual_View } from "../database.ts";
import { NostrKind } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

import { computeThreads, getTags, ParsedTag_Nostr_Event } from "../nostr.ts";

import { MessageThread } from "../UI/dm.tsx";
import { UserInfo } from "../UI/contact-list.ts";

export function getSocialPosts(
    db: Database_Contextual_View,
    allUsersInfo: Map<string, UserInfo>,
    threads: ParsedTag_Nostr_Event[][],
) {
    const t = Date.now();
    const msgs: MessageThread[] = new Array(threads.length);
    for (let i = 0; i < threads.length; i++) {
        const thread = threads[i];
        const messages: ChatMessage[] = [];
        for (let j = 0; j < thread.length; j++) {
            const event = thread[j];
            let userInfo = allUsersInfo.get(event.pubkey);
            const pubkey = PublicKey.FromHex(event.pubkey);
            if (pubkey instanceof Error) {
                throw new Error("impossible");
            }
            messages[j] = {
                event: event,
                author: {
                    pubkey: pubkey,
                    name: userInfo?.profile?.content.name,
                    picture: userInfo?.profile?.content.picture,
                },
                content: event.content,
                created_at: new Date(event.created_at * 1000),
                type: "text",
                lamport: event.parsedTags.lamport_timestamp,
            };
        }
        msgs[i] = {
            root: messages[0],
            replies: messages.slice(1),
        };
    }
    console.log("getSocialPosts:end", Date.now() - t);
    return msgs;
}
