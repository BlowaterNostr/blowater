import { Database } from "../database.ts";

const damus = "wss://relay.damus.io";
const nos = "wss://nos.lol";

const defaults = [
    nos,
    damus,
    "wss://relay.nostr.ai",
    "wss://relay.nostr.wirednet.jp",
];

export function getRelayURLs(db: Database): string[] {
    return defaults;
}

export function setRelayURLs(urls: string[]) {
    console.log(urls);
}
