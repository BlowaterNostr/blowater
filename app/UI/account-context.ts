import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import {
    InMemoryAccountContext,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    UnsignedNostrEvent,
} from "../../libs/nostr.ts/nostr.ts";
import { LocalPrivateKeyController } from "./sign-in.ts";

type NIP07 = {
    getPublicKey(): Promise<string>;
    signEvent<T extends NostrKind>(event: UnsignedNostrEvent<T>): Promise<NostrEvent<T>>;
    getRelays(): { [url: string]: { read: boolean; write: boolean } };
    nip04: {
        encrypt: (pubkey: string, plaintext: string) => Promise<string | Error>;
        decrypt: (pubkey: string, ciphertext: string) => Promise<string | Error>;
    };
    nip44: {
        encrypt: (pubkey: string, plaintext: string) => Promise<string | Error>;
        decrypt: (pubkey: string, ciphertext: string) => Promise<string | Error>;
    };
};

export class Nip7ExtensionContext implements NostrAccountContext {
    static async New(): Promise<Nip7ExtensionContext | Error | undefined> {
        // wait for nip-07 extension init
        await sleep(20);
        let ext;
        if ("nostr" in window) {
            ext = window.nostr as NIP07;
        } else {
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
        private nip07: NIP07,
        public publicKey: PublicKey,
    ) {
        console.log(nip07);
    }

    async signEvent<T extends NostrKind = NostrKind>(event: UnsignedNostrEvent<T>) {
        return this.nip07.signEvent(event);
    }

    encrypt = async (pubkey: string, plaintext: string) => {
        if (!("nip44" in this.nip07)) {
            return new Error(
                "This NIP-07 extension does not implement NIP-44, please use a NIP-44 compatible one",
            );
        }
        try {
            return this.nip07.nip44.encrypt(pubkey, plaintext);
        } catch (e) {
            return e as Error;
        }
    };

    decrypt = async (pubkey: string, ciphertext: string) => {
        try {
            if (ciphertext.includes("?iv")) {
                return await this.nip07.nip04.decrypt(pubkey, ciphertext);
            } else {
                if (!("nip44" in this.nip07)) {
                    return new Error(
                        "This NIP-07 extension does not implement NIP-44, please use a NIP-44 compatible one",
                    );
                }
                return await this.nip07.nip44.decrypt(pubkey, ciphertext);
            }
        } catch (e) {
            return e as Error;
        }
    };
}

export async function GetLocalStorageAccountContext() {
    const priKey = await LocalPrivateKeyController.getKey("blowater");
    if (priKey instanceof Error) {
        return priKey;
    } else if (priKey == undefined) {
        return undefined;
    }
    return InMemoryAccountContext.New(priKey);
}
