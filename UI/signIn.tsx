/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { GetLocalStorageAccountContext, Nip7ExtensionContext } from "./account-context.ts";
import { ButtonClass, CenterClass, DividerClass } from "./components/tw.ts";
import KeyView from "./key-view.tsx";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { emitFunc, EventEmitter } from "../event-bus.ts";
import { Signal, signal } from "https://esm.sh/@preact/signals@1.2.1";

export type SignInEvent = {
    type: "signin";
    privateKey?: PrivateKey; // undefined means sign in with extentions
} | {
    type: "editSignInPrivateKey";
    privateKey: string;
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

type Props = {
    eventBus: EventEmitter<SignInEvent>;
} & SignInModel;

export type SignInModel = {
    privateKey: string;
    warningString?: string;
};

type State = { state: "newAccount" | "enterPrivateKey" };
export class SignIn extends Component<Props, State> {
    render() {
        const props = this.props;

        if (this.state.state == "newAccount") {
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
                            onClick={on_BackToSignInPage_click(props.eventBus.emit, this.setState.bind(this))}
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
                class={tw`h-screen w-screen bg-[#313338] flex items-center justify-center p-4 overflow-y-auto`}
            >
                <div class={tw`w-[40rem]`}>
                    <img
                        class={tw`w-32 h-32 mx-auto`}
                        src="logo.png"
                        alt="Logo"
                    />
                    <h1
                        class={tw`text-[#F3F4EA] text-center text-[2rem]`}
                    >
                        Welcome to Blowater
                    </h1>
                    <input
                        onInput={on_EditSignInPrivateKey_clicked(props.eventBus.emit)}
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
                        onClick={on_SignIn_clicked(privateKey, props.eventBus.emit)}
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
                        onClick={on_CreateAccount_clicked(props.eventBus.emit, this.setState.bind(this))}
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
}

const on_CreateAccount_clicked = (emit: emitFunc<SignInEvent>, setState: (state: State) => void) => () => {
    setState({ state: "newAccount" });
};

const on_SignIn_clicked = (privateKey: PrivateKey | Error, emit: emitFunc<SignInEvent>) => () => {
    if (privateKey instanceof PrivateKey) {
        emit({
            type: "signin",
            privateKey: privateKey,
        });
    }
};

const on_EditSignInPrivateKey_clicked =
    (emit: emitFunc<SignInEvent>) => (e: h.JSX.TargetedEvent<HTMLInputElement, Event>) => {
        emit({
            type: "editSignInPrivateKey",
            privateKey: e.currentTarget.value,
        });
    };

const on_BackToSignInPage_click = (emit: emitFunc<SignInEvent>, setState: (state: State) => void) => () => {
    setState({ state: "enterPrivateKey" });
};
