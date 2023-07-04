import { Database } from "../database.ts";
import { getProfiles, ProfileData, ProfileEvent } from "../features/profile.ts";
import { NostrEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { getTags, groupImageEvents, reassembleBase64ImageFromEvents } from "../nostr.ts";
import { ChatMessage } from "./message.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { ContactGroup } from "./contact-list.tsx";
import { DM_EditorModel } from "./editor.tsx";
import { SearchModel } from "./search_model.ts";
import { UserInfo } from "./contact-list.ts";

export type DM_Container_Model = {
    search: SearchModel;

    selectedContactGroup: ContactGroup;
    currentSelectedContact: PublicKey | undefined;
    focusedContent: Map<string, NostrEvent /* thread root event */ | PublicKey /* selected user profile */>;
    hasNewMessages: Set<string>;
    subscribeProfiles: string[];
};

export function convertEventsToChatMessages(
    events: Iterable<NostrEvent>,
    userProfiles: Map<string, UserInfo>,
): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const groups = groupImageEvents(events);
    let pubKeys = Array.from(groups.values()).map((es) => es[0].pubkey);

    let textEvents = groups.get(undefined);
    if (textEvents === undefined) {
        textEvents = [];
    }
    pubKeys = pubKeys.concat(textEvents.map((e) => e.pubkey));

    groups.delete(undefined);

    for (let i = 0; i < textEvents.length; i++) {
        const author = userProfiles.get(textEvents[i].pubkey);
        const pubkey = PublicKey.FromHex(textEvents[i].pubkey);
        if (pubkey instanceof Error) {
            throw new Error(textEvents[i].pubkey);
        }
        messages.push({
            event: textEvents[i],
            content: textEvents[i].content,
            type: "text",
            created_at: new Date(textEvents[i].created_at * 1000),
            author: {
                pubkey,
                name: author?.profile?.content.name,
                picture: author?.profile?.content.picture,
            },
            lamport: getTags(textEvents[i]).lamport_timestamp,
        });
    }

    for (const imageEvents of groups.values()) {
        const imageBase64 = reassembleBase64ImageFromEvents(imageEvents);
        if (imageBase64 instanceof Error) {
            console.info(imageBase64.message);
            continue;
        }
        const author = userProfiles.get(imageEvents[0].pubkey);
        const pubkey = PublicKey.FromHex(imageEvents[0].pubkey);
        if (pubkey instanceof Error) {
            throw new Error(imageEvents[0].pubkey);
        }
        messages.push({
            event: imageEvents[0],
            content: imageBase64,
            type: "image",
            created_at: new Date(imageEvents[0].created_at * 1000),
            author: {
                pubkey: pubkey,
                name: author?.profile?.content.name,
                picture: author?.profile?.content.picture,
            },
            lamport: getTags(imageEvents[0]).lamport_timestamp,
        });
    }

    return messages;
}
