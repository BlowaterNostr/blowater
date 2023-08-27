/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { GetLocalStorageAccountContext, Nip7ExtensionContext } from "./account-context.ts";
import { ButtonClass, CenterClass, DividerClass } from "./components/tw.ts";
import KeyView from "./key-view.tsx";
import { PrivateKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    InMemoryAccountContext,
    NostrAccountContext,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { EventBus, EventEmitter } from "../event-bus.ts";

export type SignInEvent = {
    type: "signin";
    privateKey?: PrivateKey; // undefined means sign in with extentions
} | {
    type: "editSignInPrivateKey";
    privateKey: string;
} | {
    type: "createNewAccount";
} | {
    type: "backToSignInPage";
};

type Props = {
    eventBus: EventEmitter<SignInEvent>;
} & SignInModel;

export type SignInModel = {
    state: "newAccount" | "enterPrivateKey";
    privateKey: string;
    warningString?: string;
};

const AlbyURL = "https://getalby.com/";

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
        const albyCtx = await Nip7ExtensionContext.New();
        if (albyCtx instanceof Error) {
            return albyCtx;
        }
        if (albyCtx === undefined) {
            setSignInState("none");
        }
        return albyCtx;
    }
    if (getSignInState() === "local") {
        const ctx = GetLocalStorageAccountContext();
        if (ctx instanceof Error) {
            throw ctx;
        }
        if (ctx === undefined) {
            console.log("GetLocalStorageAccountContext is undefined");
            setSignInState("none");
        }
        return ctx;
    }
    return undefined;
}

export async function signInWithExtension() {
    const albyCtx = await Nip7ExtensionContext.New();
    if (albyCtx instanceof Error) {
        return albyCtx;
    }
    if (albyCtx === undefined) {
        open(AlbyURL);
    } else {
        try {
            const enabled = await albyCtx.enable();
            if (enabled) {
                setSignInState("nip07");
            } else {
                console.error("User rejected Alby login");
            }
        } catch (e) {
            console.log(e);
            return "You rejected Alby login. Refresh page to enable it again.";
        }
    }
    return albyCtx;
}

export function signInWithPrivateKey(privateKey: PrivateKey) {
    const ctx = InMemoryAccountContext.New(privateKey);
    if (ctx instanceof Error) {
        throw ctx;
    }
    localStorage.setItem("MPK", privateKey.hex);
    setSignInState("local");
    return ctx;
}

export function SignIn(props: Props) {
    if (props.state == "newAccount") {
        const privateKey = PrivateKey.Generate();
        return (
            <div
                class={tw`fixed inset-0 bg-[#313338] flex items-center justify-center px-4`}
            >
                <div class={tw`flex flex-col w-[40rem]`}>
                    <KeyView
                        privateKey={privateKey}
                        publicKey={privateKey.toPublicKey()}
                    />
                    <button
                        onClick={() => {
                            props.eventBus.emit({
                                type: "backToSignInPage",
                            });
                        }}
                        class={tw`w-full mt-8 bg-[#404249] hover:bg-[#2B2D31] ${ButtonClass}`}
                    >
                        Back
                    </button>
                    <button
                        onClick={() => {
                            props.eventBus.emit({
                                type: "signin",
                                privateKey: privateKey,
                            });
                        }}
                        class={tw`w-full mt-8 bg-[#ED4545] hover:bg-[#E03030] ${ButtonClass}`}
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    let privateKey = PrivateKey.FromHex(props.privateKey);
    if (privateKey instanceof Error) {
        privateKey = PrivateKey.FromBech32(props.privateKey);
    }

    return (
        <div
            class={tw`fixed inset-0 bg-[#313338] flex items-center justify-center px-4`}
        >
            <div class={tw`w-[40rem]`}>
                <h1
                    class={tw`text-[#F3F4EA] text-center text-[2rem] flex items-center justify-center`}
                >
                    <img
                        class={tw`w-20 h-20 mr-4`}
                        src="logo.png"
                        alt="Logo"
                    /> Welcome to Blowater
                </h1>
                <input
                    onInput={(e) => {
                        props.eventBus.emit({
                            type: "editSignInPrivateKey",
                            privateKey: e.currentTarget.value,
                        });
                    }}
                    placeholder="Input your private key here"
                    type="password"
                    class={tw`w-full px-4 py-2 focus-visible:outline-none rounded-lg mt-8`}
                />
                {privateKey instanceof Error
                    ? (
                        <p class={tw`text-[#F3F4EA] mt-2`}>
                            Private Key has to be 64 letters hex-decimal or 63 letters nsec string
                        </p>
                    )
                    : undefined}
                <button
                    onClick={() => {
                        if (privateKey instanceof PrivateKey) {
                            props.eventBus.emit({
                                type: "signin",
                                privateKey: privateKey,
                            });
                        }
                    }}
                    disabled={privateKey instanceof Error}
                    class={tw`w-full bg-[#2B2D31] hover:bg-[#404249] mt-4 disabled:bg-[#404249] ${ButtonClass}`}
                >
                    Sign In
                </button>

                <div class={tw`h-16 w-full relative ${CenterClass}`}>
                    <div class={tw`${DividerClass}`}></div>
                    <div class={tw`absolute w-full h-full ${CenterClass}`}>
                        <span class={tw`bg-[#313338] px-2 text-[#F3F4EA]`}>Or you can</span>
                    </div>
                </div>

                <button
                    onClick={() => {
                        props.eventBus.emit({
                            type: "signin",
                        });
                    }}
                    class={tw`${ButtonClass} ${CenterClass} w-full bg-[#F8C455] text-[#313338] hover:bg-[#FFDF6F] py-0`}
                >
                    <img
                        class={tw`h-10`}
                        src="alby-logo.svg"
                        alt="Alby Logo"
                    />
                    Sign in with Alby
                </button>
                <button
                    onClick={() => {
                        props.eventBus.emit({
                            type: "createNewAccount",
                        });
                    }}
                    class={tw`${ButtonClass} w-full bg-[#2B2D31] hover:bg-[#404249] mt-4`}
                >
                    Create an account
                </button>

                {props.warningString
                    ? <p class={tw`text-[#F3F4EA] mt-2`}>{props.warningString}</p>
                    : undefined}
            </div>
        </div>
    );
}
