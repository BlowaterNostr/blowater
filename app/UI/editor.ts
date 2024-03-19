import { Tag } from "../nostr.ts";
import { parseContent } from "./message.ts";

export function generateTags(content: string) {
    let tags: Tag[] = [];
    const parsedTextItems = parseContent(content);
    for (const item of parsedTextItems) {
        if (item.type === "nevent") {
            tags.push(["e", item.event.pointer.id, item.event.pointer.relays?.[0] || "", "mention"]);
            item.event.pointer.pubkey ? tags.push(["p", item.event.pointer.pubkey.hex, "", "mention"]) : null;
            tags.push(["q", item.event.pointer.id]);
        } else if (item.type === "npub") {
            tags.push(["p", item.pubkey.hex, "", "mention"]);
        }
    }
    // Remove duplicate tags, which refer to the first and second elements of the tag.
    tags = tags.filter((tag, index, self) => {
        return index === self.findIndex((t) => t[0] === tag[0] && t[1] === tag[1]);
    });
    return tags;
}
