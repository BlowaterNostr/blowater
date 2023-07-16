import { Database_Contextual_View } from "../database.ts";

const damus = "wss://relay.damus.io";
const nos = "wss://nos.lol";

export const defaultRelays = [
    nos,
    damus,
    "wss://relay.nostr.wirednet.jp",
];

export function getRelayURLs(db: Database_Contextual_View): string[] {
    return defaultRelays;
}
