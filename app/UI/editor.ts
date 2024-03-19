import { Tag } from "../nostr.ts";
import { parseContent } from "./message.ts";

export function generateTags(content: string) {
    const eTags = new Map<string, [string, string]>();
    const pTags = new Set<string>();
    const parsedTextItems = parseContent(content);
    for (const item of parsedTextItems) {
        if (item.type === "nevent") {
            eTags.set(item.event.pointer.id, [item.event.pointer.relays?.[0] || "", "mention"]);
            if (item.event.pointer.pubkey) {
                pTags.add(item.event.pointer.pubkey.hex);
            }
        } else if (item.type === "npub") {
            pTags.add(item.pubkey.hex);
        } else if (item.type === "note") {
            eTags.set(item.noteID.hex, ["", "mention"]);
        }
    }
    let tags: Tag[] = [];
    eTags.forEach((v, k) => {
        tags.push(["e", k, v[0], v[1]]);
    });
    pTags.forEach((v) => {
        tags.push(["p", v]);
    });
    return tags;
}
