import { chan, closed } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import {
    PrivateKey,
    PublicKey,
    publicKeyHexFromNpub,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    InMemoryAccountContext,
    NIP04,
    NostrAccountContext,
    NostrEvent,
    UnsignedNostrEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

type AlbyExtensionContext = {
    getPublicKey(): Promise<string>;
    signEvent(event: UnsignedNostrEvent): Promise<NostrEvent>;
    nip04: NIP04;
    enabled: boolean;
    enable: () => Promise<{ enabled: boolean }>;
};

export class AlbyAccountContext implements NostrAccountContext {
    private readonly operationChan = chan<
        "enable" | {
            op: "encrypt";
            pubkey: string;
            plaintext: string;
        } | {
            op: "decrypt";
            pubkey: string;
            ciphertext: string;
        } | {
            op: "signEvent";
            event: UnsignedNostrEvent;
        }
    >();
    private readonly enableChan = chan<boolean>();
    private readonly encryptChan = chan<string | Error>();
    private readonly decryptChan = chan<string | Error>();
    private readonly signEventChan = chan<NostrEvent>();

    static async New(): Promise<AlbyAccountContext | Error | undefined> {
        function getExtensionObject(): AlbyExtensionContext | undefined {
            if ("nostr" in window) {
                return window.nostr as AlbyExtensionContext;
            }
            return undefined;
        }
        const ext = getExtensionObject();
        if (ext === undefined) {
            return undefined;
        }
        console.log("AlbyAccountContext.New");
        let pubkey: string | undefined;
        try {
            pubkey = await ext.getPublicKey();
        } catch (e) {
            console.log(e.message);
            return e;
        }
        const pub = PublicKey.FromHex(pubkey);
        if (pub instanceof Error) {
            return pub;
        }
        return new AlbyAccountContext(ext, pub);
    }

    private constructor(
        private alby: AlbyExtensionContext,
        public publicKey: PublicKey,
    ) {
        (async () => {
            for await (const op of this.operationChan) {
                if (op === "enable") {
                    if (alby.enable == undefined) { // could be nos2x
                        await this.enableChan.put(true);
                    }
                    let isEnabled = true;
                    if (typeof (alby.enable) == "function") {
                        try {
                            const res = await alby.enable();
                            isEnabled = res.enabled;
                        } catch (e) {
                            await this.enableChan.put(false);
                        }
                    }
                    await this.enableChan.put(isEnabled);
                } else if (op.op == "encrypt") {
                    try {
                        const res = await alby.nip04.encrypt(op.pubkey, op.plaintext);
                        await this.encryptChan.put(res);
                    } catch (e) {
                        await this.encryptChan.put(e as Error);
                    }
                } else if (op.op == "decrypt") {
                    const res = await alby.nip04.decrypt(op.pubkey, op.ciphertext);
                    await this.decryptChan.put(res);
                } else if (op.op === "signEvent") {
                    const res = await alby.signEvent(op.event);
                    await this.signEventChan.put(res);
                }
            }
        })();
    }

    async signEvent(event: UnsignedNostrEvent): Promise<NostrEvent> {
        await this.operationChan.put({ op: "signEvent", event: event });
        const res = await this.signEventChan.pop();
        if (res === closed) {
            throw new Error("unreachable");
        }
        return res;
    }

    nip04: NIP04 = {
        encrypt: async (pubkey: string, plaintext: string) => {
            await this.operationChan.put({
                op: "encrypt",
                pubkey,
                plaintext,
            });
            const res = await this.encryptChan.pop();
            if (res === closed) {
                throw new Error("unreachable");
            }
            return res;
        },
        decrypt: async (pubkey: string, ciphertext: string) => {
            await this.operationChan.put({
                op: "decrypt",
                pubkey,
                ciphertext,
            });
            const res = await this.decryptChan.pop();
            if (res === closed) {
                throw new Error("unreachable");
            }
            return res;
        },
    };

    enable = async (): Promise<boolean> => {
        await this.operationChan.put("enable");
        const res = await this.enableChan.pop();
        if (res === closed) {
            throw new Error("unreachable");
        }
        return res;
    };
}

export function GetLocalStorageAccountContext() {
    const loginPrivateKey = localStorage.getItem("MPK");
    if (loginPrivateKey) {
        const priKey = PrivateKey.FromHex(loginPrivateKey);
        if (!(priKey instanceof Error)) {
            return InMemoryAccountContext.New(priKey);
        }
        console.error("the stored MPK is not a valid private, removing it");
        localStorage.removeItem("MPK");
        return undefined;
    }
    return undefined;
}
