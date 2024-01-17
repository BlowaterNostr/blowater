import { chan, closed, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PrivateKey, PublicKey } from "../../libs/nostr.ts/key.ts";
import {
    InMemoryAccountContext,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    UnsignedNostrEvent,
} from "../../libs/nostr.ts/nostr.ts";
import { LocalPrivateKeyController } from "./signIn.tsx";

type NIP07 = {
    getPublicKey(): Promise<string>;
    signEvent(event: UnsignedNostrEvent): Promise<NostrEvent>;
    nip04: {
        encrypt: (pubkey: string, plaintext: string) => Promise<string | Error>;
        decrypt: (pubkey: string, ciphertext: string) => Promise<string | Error>;
    };
    enabled: boolean;
    enable: () => Promise<{ enabled: boolean }>;
};

export class Nip7ExtensionContext implements NostrAccountContext {
    private readonly operationChan = chan<
        {
            op: "encrypt";
            pubkey: string;
            plaintext: string;
        } | {
            op: "signEvent";
            event: UnsignedNostrEvent;
        }
    >();

    private readonly encryptChan = chan<string | Error>();
    // private readonly decryptChan = chan<string | Error>();
    private readonly signEventChan = chan<NostrEvent>();

    static async New(): Promise<Nip7ExtensionContext | Error | undefined> {
        async function getExtensionObject(): Promise<NIP07 | undefined> {
            // wait for alby or nos2x init
            await sleep(20);
            if ("nostr" in window) {
                return window.nostr as NIP07;
            }
            return undefined;
        }
        const ext = await getExtensionObject();
        if (ext === undefined) {
            return undefined;
        }
        let pubkey: string | undefined;
        try {
            pubkey = await ext.getPublicKey();
        } catch (e) {
            return e;
        }
        const pub = PublicKey.FromHex(pubkey);
        if (pub instanceof Error) {
            return pub;
        }
        return new Nip7ExtensionContext(ext, pub);
    }

    private constructor(
        private alby: NIP07,
        public publicKey: PublicKey,
    ) {
        console.log(alby);
        (async () => {
            for await (const op of this.operationChan) {
                if (op.op == "encrypt") {
                    try {
                        const res = await alby.nip04.encrypt(op.pubkey, op.plaintext);
                        await this.encryptChan.put(res);
                    } catch (e) {
                        await this.encryptChan.put(e as Error);
                    }
                } else if (op.op === "signEvent") {
                    const res = await alby.signEvent(op.event);
                    await this.signEventChan.put(res);
                }
            }
        })();
    }

    async signEvent<T extends NostrKind = NostrKind>(event: UnsignedNostrEvent<T>): Promise<NostrEvent<T>> {
        await this.operationChan.put({ op: "signEvent", event: event });
        const res = await this.signEventChan.pop();
        if (res === closed) {
            throw new Error("unreachable");
        }
        // @ts-ignore
        return res;
    }

    encrypt = async (pubkey: string, plaintext: string) => {
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
    };
    decrypt = async (pubkey: string, ciphertext: string) => {
        try {
            const res = await this.alby.nip04.decrypt(pubkey, ciphertext);
            return res;
        } catch (e) {
            return e as Error;
        }
    };
}

export async function GetLocalStorageAccountContext(pin: string) {
    const priKey = await LocalPrivateKeyController.getKey(pin);
    if (priKey instanceof Error) {
        return priKey;
    } else if(priKey == undefined) {
        return undefined
    }
    return InMemoryAccountContext.New(priKey)
}
