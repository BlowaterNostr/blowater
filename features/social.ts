import { ChatMessage } from "../UI/message.ts";
import { Database_Contextual_View } from "../database.ts";
import { NostrKind } from "../lib/nostr.ts/nostr.ts";

import { computeThreads } from "../nostr.ts";

import { MessageThread } from "../UI/dm.tsx";
import { UserInfo } from "../UI/contact-list.ts";

export function getSocialPosts(
    db: Database_Contextual_View,
    allUsersInfo: Map<string, UserInfo>,
) {
    const t = Date.now();
    const events = [];
    for (const e of db.events) {
        if (e.kind == NostrKind.TEXT_NOTE) {
            events.push(e);
        }
    }
    console.log("getSocialPosts:filterEvents", Date.now() - t);
    const threads = computeThreads(events);
    console.log("getSocialPosts:computeThreads", Date.now() - t);
    const msgs: MessageThread[] = new Array(threads.length);
    for (let i = 0; i < threads.length; i++) {
        const thread = threads[i];
        const messages: ChatMessage[] = [];
        for (let j = 0; j < thread.length; j++) {
            const event = thread[j];
            messages[j] = {
                event: event,
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
