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
                this.newMessage.delete(hex);
                break;
        }
    }
}
