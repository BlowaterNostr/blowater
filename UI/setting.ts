import {
    NostrAccountContext,
    NostrKind,
    prepareCustomAppDataEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { CustomAppData, Decrypted_Nostr_Event, Parsed_Event } from "../nostr.ts";

const damus = "wss://relay.damus.io";
const nos = "wss://nos.lol";

export const defaultRelays = [
    nos,
    damus,
    "wss://relay.nostr.wirednet.jp",
];

export class RelayConfig {
    constructor(
        public readonly pool: ConnectionPool,
        public readonly ctx: NostrAccountContext,
    ) {}

    getRelayURLs(): string[] {
        const urls = this.pool.getRelays().map((r) => r.url);
        return urls;
    }

    async addEvents(events: Decrypted_Nostr_Event[]) {
        for (const event of events) {
            const obj: CustomAppData = JSON.parse(event.decryptedContent);
            if (obj.type == "AddRelay") {
                const err = await this.pool.addRelayURL(obj.url);
                if (err instanceof Error) {
                    console.error(err);
                    continue;
                }
            }
        }
    }

    async addRelayURL(url: string) {
        const err = await this.pool.addRelayURL(url);
        if (err instanceof Error) {
            return err;
        }
        const event = await prepareCustomAppDataEvent<CustomAppData>(this.ctx, {
            type: "AddRelay",
            url: url,
        });
        if (event instanceof Error) {
            return event;
        }
        this.pool.sendEvent(event);
    }
}
