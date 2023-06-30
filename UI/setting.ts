const damus = "wss://relay.damus.io";
const nos = "wss://nos.lol";

const defaults = [
    nos,
    damus,
    "wss://relay.nostr.ai",
    "wss://relay.nostr.wirednet.jp",
];

const key = "relay-config";

export class RelayConfig {
    static getURLs(): string[] {
        const item = localStorage.getItem(key);
        if (item == null) {
            return defaults;
        }
        const urls = JSON.parse(item);
        if (urls instanceof Array) {
            return urls;
        }
        return defaults;
    }

    static setURLs(urls: string[]) {
        console.log(urls);
        localStorage.setItem(key, JSON.stringify(urls));
    }
}
