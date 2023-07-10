import { Database } from "../database.ts";
import {
    NostrAccountContext,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";

import { computeThreads, getTags } from "../nostr.ts";

import { UserInfo } from "../UI/contact-list.ts";

import { ChatMessage_v2 } from "../UI/message.ts";
import { MessageThread } from "../UI/dm.tsx";

export function getSocialPosts(db: Database, allUsersInfo: Map<string, UserInfo>, ctx: NostrAccountContext) {
    const t = Date.now();
    const events = db.filterEvents((e) => {
        return e.kind == NostrKind.TEXT_NOTE;
    });

    const threads = computeThreads(Array.from(events));
    console.log("getSocialPosts:threads", Date.now() - t);
    const msgs: MessageThread[] = new Array(threads.length);
    for (let i = 0; i < threads.length; i++) {
        const thread = threads[i];
        const messages: ChatMessage_v2[] = [];
        for (let j = 0; j < thread.length; j++) {
            const event = thread[j];
            let userInfo = allUsersInfo.get(event.pubkey);
            const pubkey = PublicKey.FromHex(event.pubkey);
            if (pubkey instanceof Error) {
                throw new Error("impossible");
            }
            messages[j] = new ChatMessage_v2({
                root_event: event,
                author: {
                    pubkey: pubkey,
                    name: userInfo?.profile?.content.name,
                    picture: userInfo?.profile?.content.picture,
                },
                content: event.content,
                created_at: new Date(event.created_at * 1000),
                type: "text",
                lamport: getTags(event).lamport_timestamp,
                ctx: ctx,
            });
        }
        msgs[i] = {
            root: messages[0],
            replies: messages.slice(1),
        };
    }
    console.log("getSocialPosts:end", Date.now() - t);
    return msgs;
}
