import { NostrKind } from "../lib/nostr-ts/nostr.ts";
import { Parsed_Event } from "../nostr.ts";

export interface NewMessageGetter {
    getNewMessage(hex: string, isGourpChat: boolean): Set<string> | undefined;
}

export interface NewMessageSetter {
    setNewMessage(type: "unread" | "read", hex: string, eventID?: string): void;
}

export class NewMessageController implements NewMessageGetter, NewMessageSetter {
    private newMessage = new Map<string, Set<string>>();

    getNewMessage(hex: string, isGourpChat: boolean) {
        return this.newMessage.get(hex);
    }

    setNewMessage(type: "unread" | "read", hex: string, eventID?: string) {
        const set = this.newMessage.get(hex);
        switch (type) {
            case "unread":
                if (!eventID) {
                    return;
                }
                if (set) {
                    set.add(eventID);
                } else {
                    this.newMessage.set(hex, new Set([eventID]));
                }
                break;
            case "read":
                if (!set) {
                    return;
                }
                if (eventID) {
                    set.delete(eventID);
                    return;
                }
                set.clear();
                break;
        }
    }

    addEvents(events: Parsed_Event[]) {
        for (const event of events) {
            if (event.kind == NostrKind.DIRECT_MESSAGE) {
                this.setNewMessage("unread", event.pubkey, event.id);
            }
        }
    }
}
