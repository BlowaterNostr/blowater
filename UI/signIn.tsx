/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";

import { GetLocalStorageAccountContext, Nip7ExtensionContext } from "./account-context.ts";
import { ButtonClass, CenterClass, LinearGradientsClass, NoOutlineClass } from "./components/tw.ts";
import KeyView from "./key-view.tsx";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { emitFunc } from "../event-bus.ts";
import {
    ErrorColor,
    HintLinkColor,
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
    nip07Error: string;
};
export class SignIn extends Component<Props, State> {
    styles = {
        container:
            `h-screen w-screen bg-[${PrimaryBackgroundColor}] flex items-center justify-center p-4 overflow-y-auto`,
        form: `w-[30rem] flex flex-col h-full py-8`,
        logo: `w-32 h-32 mx-auto`,
        title: `text-[${PrimaryTextColor}] text-center text-4xl`,
        subTitle: `text-[${HintTextColor}] text-center`,
        input: `w-full px-4 py-2 focus-visible:outline-none rounded-lg mt-8`,
        hint: `text-[${HintTextColor}] text-sm mt-2`,
        block: `flex-1 desktop:hidden`,
        signInButton:
            `w-full mt-4 ${ButtonClass} ${LinearGradientsClass} hover:bg-gradient-to-l mobile:rounded-full font-bold`,
        cancelButton:
            `${ButtonClass} ${CenterClass} mt-4 bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}] hover:bg-[${HoverButtonBackgroudColor}] mobile:rounded-full`,
        newButton:
            `text-[${HintLinkColor}] hover:underline mobile:text-[${PrimaryTextColor}] mobile:bg-[${HintLinkColor}] mobile:rounded mobile:px-2 mobile:py-1 ${NoOutlineClass}`,
        ablyIcon: `h-10`,
        isError: (error: string) => error ? `text-[${ErrorColor}]` : "",
    };

    signInWithPrivateKey = () => {
        if (!this.state.privateKey) {
            this.setState({
                privateKeyError: "Invilid Private Key",
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
        const nip07Ctx = await Nip7ExtensionContext.New();
        if (nip07Ctx === undefined) {
            open(AlbyURL);
            return;
        }
        if (typeof nip07Ctx == "string") {
            this.setState({
                nip07Error: nip07Ctx,
            });
        } else if (nip07Ctx instanceof Error) {
            this.setState({
                nip07Error: nip07Ctx.message,
            });
        } else {
            this.props.emit({
                type: "SignInEvent",
                ctx: nip07Ctx,
            });
        }
    };

    newAccount = () => {
        this.setState({
            privateKey: PrivateKey.Generate(),
            privateKeyError: "",
            state: "newAccount",
        });
    };

    cancelNew = () => {
        this.setState({
            state: "enterPrivateKey",
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
                            <strong>63</strong> letters nsec string.
                        </span>{" "}
                        Don't have an account yet?{" "}
                        <button onClick={this.newAccount} class={this.styles.newButton}>create one!</button>
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
                        class={this.styles.signInButton}
                    >
                        Sign in with Nostr Extension
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
