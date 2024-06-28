import { GetLocalStorageAccountContext, Nip7ExtensionContext } from "./account-context.ts";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";

export type SignInEvent = {
    type: "SignInEvent";
    ctx: NostrAccountContext;
};

type SignInState = "none" | "nip07" | "local";

export function getSignInState(): SignInState {
    const state = localStorage.getItem("SignInState");
    if (state === null) {
        return "none";
    }
    return state as SignInState;
}

export function setSignInState(state: SignInState) {
    localStorage.setItem("SignInState", state);
}

////////////////////////
// Check Login Status //
////////////////////////
export async function getCurrentSignInCtx() {
    if (getSignInState() === "nip07") {
        const nip07Ctx = await Nip7ExtensionContext.New();
        if (nip07Ctx instanceof Error) {
            return nip07Ctx;
        }
        if (nip07Ctx === undefined) {
            setSignInState("none");
        }
        return nip07Ctx;
    }
    if (getSignInState() === "local") {
        const ctx = await GetLocalStorageAccountContext();
        if (ctx instanceof Error) {
            return ctx;
        }
        if (ctx === undefined) {
            console.log("GetLocalStorageAccountContext is undefined");
            setSignInState("none");
        }
        return ctx;
    }
    return undefined;
}

export class LocalPrivateKeyController {
    static cleanOldVersionDate() {
        localStorage.removeItem("MPK");
    }

    static async setKey(pin: string, pri: PrivateKey) {
        // hash the pin
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hash = await crypto.subtle.digest("SHA-256", data);

        // encrypt the private key
        const key = await crypto.subtle.importKey(
            "raw",
            hash,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt"],
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            new TextEncoder().encode(pri.hex),
        );

        // store the key
        localStorage.setItem(
            `private key`,
            JSON.stringify({
                encrypted: toBase64(new Uint8Array(encrypted)),
                iv: toBase64(new Uint8Array(iv)),
            }),
        );
    }

    static async getKey(pin: string): Promise<PrivateKey | Error | undefined> {
        // Retrieve the encrypted data from localStorage
        const stored = localStorage.getItem(`private key`);
        if (!stored) return undefined;

        const { encrypted, iv } = JSON.parse(stored);
        const encryptedData = decodeBase64(encrypted);
        const ivData = decodeBase64(iv);

        // Hash the pin
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hash = await crypto.subtle.digest("SHA-256", data);

        // Decrypt the private key
        const key = await crypto.subtle.importKey(
            "raw",
            hash,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"],
        );

        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: ivData },
                key,
                encryptedData,
            );
            const private_hex = new TextDecoder().decode(decrypted);
            return PrivateKey.FromHex(private_hex);
        } catch (e) {
            return e as Error;
        }
    }
}

function toBase64(uInt8Array: Uint8Array) {
    let strChunks = new Array(uInt8Array.length);
    let i = 0;
    for (let byte of uInt8Array) {
        strChunks[i] = String.fromCharCode(byte); // bytes to utf16 string
        i++;
    }
    return btoa(strChunks.join(""));
}

function decodeBase64(base64String: string) {
    const binaryString = atob(base64String);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
