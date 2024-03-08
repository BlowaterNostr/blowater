import { Component, h } from "https://esm.sh/preact@10.17.1";
import { GetLocalStorageAccountContext, Nip7ExtensionContext } from "./account-context.ts";
import { ButtonClass, CenterClass, LinearGradientsClass, NoOutlineClass } from "./components/tw.ts";
import KeyView from "./key-view.tsx";
import { emitFunc } from "../event-bus.ts";
import {
    ErrorColor,
    HintLinkColor,
    HintTextColor,
    HoverButtonBackgroundColor,
    PrimaryBackgroundColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";
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

type Props = {
    emit: emitFunc<SignInEvent>;
};

type State = {
    step: "newAccount" | "enterPrivateKey";
    privateKey: PrivateKey;
    privateKeyError: string;
    nip07Error: string;
};
export class SignInOld extends Component<Props, State> {
    styles = {
        container: `h-screen w-screen bg-[${PrimaryBackgroundColor}] ` +
            `flex flex-col items-center justify-center p-4 overflow-y-auto`,
        form: `w-[30rem] flex flex-col h-full py-8`,
        logo: `w-32 h-32 mx-auto`,
        title: `text-[${PrimaryTextColor}] text-center text-4xl`,
        subTitle: `text-[${HintTextColor}] text-center`,
        input: `w-full px-4 py-2 focus-visible:outline-none rounded-lg mt-8`,
        hint: `text-[${HintTextColor}] text-sm mt-2`,
        signInButton:
            `w-full mt-4 ${ButtonClass} ${LinearGradientsClass} hover:bg-gradient-to-l mobile:rounded-full font-bold`,
        cancelButton:
            `${ButtonClass} ${CenterClass} mt-4 bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}] hover:bg-[${HoverButtonBackgroundColor}] mobile:rounded-full`,
        newButton:
            `text-[${HintLinkColor}] hover:underline mobile:text-[${PrimaryTextColor}] mobile:bg-[${HintLinkColor}] mobile:rounded mobile:px-2 mobile:py-1 ${NoOutlineClass}`,
        ablyIcon: `h-10`,
        isError: (error: string) => error ? `text-[${ErrorColor}]` : "",
    };

    signInWithPrivateKey = async () => {
        if (!this.state.privateKey) {
            this.setState({
                privateKeyError: "Invilid Private Key",
            });
            return;
        }
        this.props.emit({
            type: "SignInEvent",
            ctx: InMemoryAccountContext.New(this.state.privateKey),
        });
        setSignInState("local");
        await LocalPrivateKeyController.setKey("blowater", this.state.privateKey);
    };

    newAccount = () => {
        this.setState({
            privateKey: PrivateKey.Generate(),
            privateKeyError: "",
            step: "newAccount",
        });
    };

    cancelNew = () => {
        this.setState({
            step: "enterPrivateKey",
            privateKey: undefined,
        });
    };

    inputPrivateKey = (privateKeyStr: string) => {
        let privateKey = PrivateKey.FromHex(privateKeyStr);
        if (privateKey instanceof Error) {
            privateKey = PrivateKey.FromBech32(privateKeyStr);

            if (privateKey instanceof Error) {
                this.setState({
                    privateKeyError: "Invilid Private Key",
                });
                return;
            }
        }
        this.setState({
            privateKeyError: "",
            privateKey: privateKey,
        });
    };

    render() {
        if (this.state.step == "newAccount") {
            return (
                <div class={this.styles.container}>
                    <div class={this.styles.form}>
                        <KeyView
                            privateKey={this.state.privateKey}
                            publicKey={this.state.privateKey.toPublicKey()}
                        />
                        <p class={this.styles.hint}>
                            Please back up your <strong>Private Key</strong>
                        </p>
                        <button
                            onClick={this.cancelNew}
                            class={this.styles.cancelButton}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={this.signInWithPrivateKey}
                            class={this.styles.signInButton}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            );
        } else {
            return (
                <div class={this.styles.container}>
                    <div class={this.styles.form}>
                        <img class={this.styles.logo} src="logo.webp" alt="Logo" />
                        <h1 class={this.styles.title}>Blowater</h1>
                        <p class={this.styles.subTitle}>A delightful Nostr client that focuses on DM</p>
                        <input
                            onInput={(e) => this.inputPrivateKey(e.currentTarget.value)}
                            placeholder="Input your private key here"
                            type="password"
                            class={this.styles.input}
                            autofocus
                        />
                        <p class={this.styles.hint}>
                            <span class={this.styles.isError(this.state.privateKeyError)}>
                                Private Key has to be <strong>64</strong> letters hex-decimal or{" "}
                                <strong>63</strong> letters nsec string.
                            </span>{" "}
                            Don't have an account yet?{" "}
                            <button onClick={this.newAccount} class={this.styles.newButton}>
                                create one!
                            </button>
                        </p>
                        <div class={"flex-1"}></div>
                        <button
                            onClick={this.signInWithPrivateKey}
                            class={this.styles.signInButton}
                        >
                            Sign In
                        </button>
                        <p class={this.styles.hint}>
                            <span class={this.styles.isError(this.state.nip07Error)}>
                                {this.state.nip07Error}
                            </span>
                        </p>
                    </div>
                </div>
            );
        }
    }
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
            return new Error("wrong pin");
        }
    }
}
LocalPrivateKeyController.cleanOldVersionDate();

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
