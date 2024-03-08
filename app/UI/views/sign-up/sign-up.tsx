import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { InMemoryAccountContext } from "../../../../libs/nostr.ts/nostr.ts";

import { emitFunc } from "../../../event-bus.ts";
import { CopyButton } from "../../components/copy-button.tsx";
import { CenterClass, InputClass } from "../../components/tw.ts";
import { DividerBackgroundColor, PrimaryTextColor, SecondaryTextColor } from "../../style/colors.ts";
import { SecondaryBackgroundColor } from "../../style/colors.ts";
import { LocalPrivateKeyController } from "../../signIn.tsx";
import { PlaceholderColor } from "../../style/colors.ts";
import { UI_Interaction_Event } from "../../app_update.tsx";
import { PrivateKey } from "../../../../libs/nostr.ts/key.ts";

interface SignUpProps {
    // Define your component props here
    emit: emitFunc<UI_Interaction_Event>;
}

interface SignUpState {
    name: string;
    step: "onboarding" | "signin" | "name" | "backup" | "verify";
    signInSecretKey?: PrivateKey;
    signUpSecretKey: PrivateKey;
    errorPrompt: string;
    confirmSecretKey: string;
}

export class SignUp extends Component<SignUpProps, SignUpState> {
    state: SignUpState = {
        name: "",
        step: "onboarding",
        signInSecretKey: undefined,
        signUpSecretKey: InMemoryAccountContext.Generate().privateKey,
        errorPrompt: "",
        confirmSecretKey: "",
    };

    signInWithPrivateKey = async () => {
        const { signInSecretKey } = this.state;
        if (signInSecretKey === undefined) {
            this.setState({
                errorPrompt: "Secret key is incorrect",
            });
            return;
        }
        this.props.emit({
            type: "SignInEvent",
            ctx: InMemoryAccountContext.New(signInSecretKey),
        });
        localStorage.setItem("SignInState", "local");
        await LocalPrivateKeyController.setKey("blowater", signInSecretKey);
    };

    // signUpWithPrivateKey = async () => {
    //     const { name, signUpSecretKey } = this.state;
    //     this.props.emit({
    //         type: "SignUpEvent",
    //         ctx: InMemoryAccountContext.New(signUpSecretKey),
    //         name
    //     });
    //     localStorage.setItem("SignInState", "local");
    //     await LocalPrivateKeyController.setKey("blowater", signUpSecretKey);
    // }

    handleNext = () => {
        const { step } = this.state;
        if (step === "name") {
            if (this.checkNameComplete()) {
                this.setState({ step: "backup" });
            } else {
                this.setState({ errorPrompt: "Name is required" });
            }
        } else if (step === "backup") {
            this.setState({ step: "verify" });
        } else if (step === "verify") {
            if (this.checkSecretKeyComplete()) {
                alert("Secret key confirmed");
                // this.signUpWithPrivateKey();
            } else {
                this.setState({ errorPrompt: "Secret key is incorrect" });
            }
        } else if (step === "signin") {
            if (this.state.signInSecretKey instanceof PrivateKey) {
                this.signInWithPrivateKey();
            } else {
                this.setState({ errorPrompt: "Secret key is incorrect" });
            }
        }
    };

    checkNameComplete = () => {
        const { name } = this.state;
        return name.length > 0;
    };

    checkSecretKeyComplete = () => {
        const { confirmSecretKey, signUpSecretKey } = this.state;
        // Check if the last 4 characters of the secret key match the input
        if (confirmSecretKey.length !== 4) return false;
        const { bech32 } = signUpSecretKey;
        return bech32.endsWith(confirmSecretKey);
    };

    handleNameChange = (event: Event) => {
        if (this.checkNameComplete()) this.setState({ errorPrompt: "" });
        this.setState({ name: (event.target as HTMLInputElement).value });
    };

    handleSignInSecretKeyInput = (privateKeyStr: string) => {
        let privateKey = PrivateKey.FromHex(privateKeyStr);
        if (privateKey instanceof Error) {
            privateKey = PrivateKey.FromBech32(privateKeyStr);

            if (privateKey instanceof Error) {
                this.setState({
                    errorPrompt: "Invilid Private Key",
                });
                return;
            }
        }
        this.setState({
            errorPrompt: "",
            signInSecretKey: privateKey,
        });
    };

    renderStep() {
        const { step, name, signUpSecretKey, confirmSecretKey, errorPrompt } = this.state;
        const setpOnboarding = () => {
            return (
                <Fragment>
                    <div class={`text-4xl w-full text-center font-bold`}>Blowater</div>
                    <div class={`text-md w-full text-center ${SecondaryTextColor}`}>
                        A delightful Nostr client that focuses on DM
                    </div>
                    <button
                        onClick={() => this.setState({ step: "signin" })}
                        class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                    >
                        Alreay have an account
                    </button>
                    <button
                        onClick={() => this.setState({ step: "name" })}
                        class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                    >
                        Sign Up
                    </button>
                </Fragment>
            );
        };
        const stepSignIn = () => {
            return (
                <Fragment>
                    <div class={`text-3xl w-full text-center font-bold`}>Sign In</div>
                    <div class={`text-md w-full text-center`}>What should we call you?</div>
                    <input
                        class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                        placeholder="nsec1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        type="password"
                        autofocus
                        onInput={(e) => this.handleSignInSecretKeyInput(e.currentTarget.value)}
                    />
                    <div class={`text-red-500`}>{errorPrompt}</div>
                    <button
                        onClick={this.handleNext}
                        class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l ${
                            this.checkNameComplete() ? "" : "opacity-50 cursor-not-allowed"
                        }`}
                    >
                        Sign In
                    </button>
                    <button
                        onClick={() => this.setState({ step: "name" })}
                        class={`border-none bg-transparent text-[#FF3A5E] mt-2 focus:outline-none focus-visible:outline-none`}
                    >
                        Go back...I want to sign up
                    </button>
                </Fragment>
            );
        };
        const stepName = () => {
            return (
                <Fragment>
                    <div class={`text-3xl w-full text-center font-bold`}>Sign Up</div>
                    <div class={`text-md w-full text-center`}>What should we call you?</div>
                    <input
                        class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                        placeholder="e.g. Bob"
                        type="text"
                        value={name}
                        onInput={this.handleNameChange}
                    />
                    <div class={`text-red-500`}>{errorPrompt}</div>
                    <button
                        onClick={this.handleNext}
                        class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l ${
                            this.checkNameComplete() ? "" : "opacity-50 cursor-not-allowed"
                        }`}
                    >
                        Next
                    </button>
                </Fragment>
            );
        };
        const stepBackup = () => {
            return (
                <Fragment>
                    <div class={`text-3xl w-full text-center font-bold`}>Backup your keys</div>
                    <div
                        class={`bg-red-500  flex flex-row p-2  gap-2 items-center`}
                    >
                        <svg viewBox="0 0 24 24" focusable="false" class="w-10 h-10">
                            <path
                                fill="currentColor"
                                d="M12,0A12,12,0,1,0,24,12,12.013,12.013,0,0,0,12,0Zm.25,5a1.5,1.5,0,1,1-1.5,1.5A1.5,1.5,0,0,1,12.25,5ZM14.5,18.5h-4a1,1,0,0,1,0-2h.75a.25.25,0,0,0,.25-.25v-4.5a.25.25,0,0,0-.25-.25H10.5a1,1,0,0,1,0-2h1a2,2,0,0,1,2,2v4.75a.25.25,0,0,0,.25.25h.75a1,1,0,1,1,0,2Z"
                            >
                            </path>
                        </svg>
                        <div>
                            Your secret key is like your password, if anyone gets a hold of it they will have
                            complete control over your account
                        </div>
                    </div>
                    <div>
                        <div class={`text-lg font-semibold`}>Secret Key</div>
                        <TextField text={signUpSecretKey.bech32} />
                        <div>This is the key to access your account, keep it secret.</div>
                    </div>

                    <button
                        onClick={this.handleNext}
                        class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                    >
                        I have saved my secret key
                    </button>
                </Fragment>
            );
        };
        const stepVerify = () => {
            return (
                <Fragment>
                    <div class={`text-3xl w-full text-center font-bold`}>Confirm secret key</div>
                    <div>
                        <div class={`text-lg font-semibold`}>
                            Last four letters of secret key
                        </div>
                        <input
                            class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                            placeholder="xxxx"
                            type="text"
                            value={confirmSecretKey}
                            onInput={(e) =>
                                this.setState({ confirmSecretKey: (e.target as HTMLInputElement).value })}
                        />
                        <div>
                            This is the key to access your account, keep it secret.
                        </div>
                    </div>
                    <div class={`text-red-500`}>{errorPrompt}</div>
                    <button
                        onClick={this.handleNext}
                        class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l ${
                            this.checkSecretKeyComplete() ? "" : "opacity-50 cursor-not-allowed"
                        }`}
                    >
                        Confirm
                    </button>
                    <button
                        onClick={() => this.setState({ step: "backup" })}
                        class={`border-none bg-transparent text-[#FF3A5E] mt-2 focus:outline-none focus-visible:outline-none`}
                    >
                        Go back...I didn't save it
                    </button>
                </Fragment>
            );
        };
        switch (step) {
            case "onboarding":
                return setpOnboarding();
            case "signin":
                return stepSignIn();
            case "name":
                return stepName();
            case "backup":
                return stepBackup();
            case "verify":
                return stepVerify();
            default:
                return null;
        }
    }

    render() {
        return (
            <div
                class={`flex flex-col justify-start items-center w-full h-screen bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}]`}
            >
                <div class={`flex flex-col  w-[30rem] py-8 px-5`}>
                    <div class={`flex justify-center items-center w-full`}>
                        <img src="logo.webp" alt="Blowater Logo" class={`w-32 h-32`} />
                    </div>
                    {this.renderStep()}
                </div>
            </div>
        );
    }
}

function TextField(props: {
    text: string;
}) {
    const asterisksText = (text: string) => {
        // replate end of string with asterisks
        return text.slice(0, -50) + "*".repeat(50);
    };

    return (
        <div class={`relative ${InputClass} flex p-0`}>
            <pre class={`whitespace-pre flex-1 overflow-x-auto px-4 py-3`}>{asterisksText(props.text)}</pre>
            <div class={`w-14 ${CenterClass}`}>
                <CopyButton text={props.text} />
            </div>
        </div>
    );
}
