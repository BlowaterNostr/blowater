/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { GetLocalStorageAccountContext, Nip7ExtensionContext } from "./account-context.ts";
import { ButtonClass, CenterClass, LinearGradientsClass } from "./components/tw.ts";
import KeyView from "./key-view.tsx";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { emitFunc } from "../event-bus.ts";
import {
    ErrorColor,
    HintTextColor,
    HoverButtonBackgroudColor,
    PrimaryBackgroundColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";

export type SignInEvent = {
    type: "SignInEvent";
    ctx: NostrAccountContext;
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

type Props = {
    emit: emitFunc<SignInEvent>;
};

type State = {
    state: "newAccount" | "enterPrivateKey";
    privateKey: PrivateKey;
    privateKeyError: string;
    albyError: string;
};
export class SignIn extends Component<Props, State> {
    styles = {
        container:
            tw`h-screen w-screen bg-[${PrimaryBackgroundColor}] flex items-center justify-center p-4 overflow-y-auto`,
        form: tw`w-[30rem] flex flex-col h-full py-8`,
        logo: tw`w-32 h-32 mx-auto`,
        title: tw`text-[${PrimaryTextColor}] text-center text-4xl`,
        subTitle: tw`text-[${HintTextColor}] text-center`,
        input: tw`w-full px-4 py-2 focus-visible:outline-none rounded-lg mt-8`,
        hint: tw`text-[${HintTextColor}] text-sm mt-2`,
        block: tw`flex-1 desktop:hidden`,
        signInButton:
            tw`w-full mt-4 ${ButtonClass} ${LinearGradientsClass} hover:bg-gradient-to-l mobile:rounded-full font-bold`,
        ablyButton:
            tw`${ButtonClass} ${CenterClass} mt-4 bg-[#F8C455] text-[#313338] hover:bg-[#FFDF6F] py-0 mobile:hidden`,
        cancelButton:
            tw`${ButtonClass} ${CenterClass} mt-4 bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}] hover:bg-[${HoverButtonBackgroudColor}] mobile:rounded-full`,
        ablyIcon: tw`h-10`,
        isError: (error: string) => error ? tw`text-[${ErrorColor}]` : "",
    };

    signInWithPrivateKey = () => {
        if (!this.state.privateKey && !this.state.privateKeyError) {
            this.setState({
                state: "newAccount",
                privateKeyError: "",
                privateKey: PrivateKey.Generate(),
            });
            return;
        }

        const ctx = InMemoryAccountContext.New(this.state.privateKey);
        localStorage.setItem("MPK", this.state.privateKey.hex);
        setSignInState("local");

        this.props.emit({
            type: "SignInEvent",
            ctx: ctx,
        });
    };

    signInWithExtension = async () => {
        const albyCtx = await Nip7ExtensionContext.New();
        if (albyCtx === undefined) {
            open(AlbyURL);
            return;
        }
        if (typeof albyCtx == "string") {
            this.setState({
                albyError: albyCtx,
            });
        } else if (albyCtx instanceof Error) {
            this.setState({
                albyError: albyCtx.message,
            });
        } else {
            this.props.emit({
                type: "SignInEvent",
                ctx: albyCtx,
            });
        }
    };

    cancelNew = () => {
        this.setState({
            state: "enterPrivateKey",
            privateKey: undefined,
        });
    };

    inputPrivateKey = (privateKeyStr: string) => {
        if (privateKeyStr != "") {
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
        } else {
            this.setState({
                privateKeyError: "",
            });
        }
    };

    render() {
        if (this.state.state == "newAccount") {
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
                        <div class={this.styles.block}></div>
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
        }

        return (
            <div class={this.styles.container}>
                <div class={this.styles.form}>
                    <img class={this.styles.logo} src="logo.png" alt="Logo" />
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
                            <strong>63</strong>
                            letters nsec string.
                        </span>{" "}
                        Or click the Sign-In button directly to create a <strong>new account</strong>
                    </p>
                    <div class={this.styles.block}></div>
                    <button
                        onClick={this.signInWithPrivateKey}
                        class={this.styles.signInButton}
                    >
                        Sign In
                    </button>

                    <button
                        onClick={async () => await this.signInWithExtension()}
                        class={this.styles.ablyButton}
                    >
                        <img class={this.styles.ablyIcon} src="alby-logo.svg" alt="Alby Logo" />
                        Sign in with Alby
                    </button>
                    <p class={this.styles.hint}>
                        <span class={this.styles.isError(this.state.albyError)}>{this.state.albyError}</span>
                    </p>
                </div>
            </div>
        );
    }
}
