import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { InMemoryAccountContext } from "../../../../libs/nostr.ts/nostr.ts";

import { emitFunc } from "../../../event-bus.ts";
import { CopyButton } from "../../components/copy-button.tsx";
import { CenterClass, InputClass } from "../../components/tw.ts";
import { DividerBackgroundColor, PrimaryTextColor } from "../../style/colors.ts";
import { SecondaryBackgroundColor } from "../../style/colors.ts";
import { LocalPrivateKeyController } from "../../signIn.tsx";
import { PlaceholderColor } from "../../style/colors.ts";
import { UI_Interaction_Event } from "../../app_update.tsx";

interface SignUpProps {
    // Define your component props here
    // emit: emitFunc<UI_Interaction_Event>
}

interface SignUpState {
    name: string;
    step: "name" | "backup" | "verify";
    errorPrompt: string;
    confirmSecretKey: string;
}

const ctx = InMemoryAccountContext.Generate();

export class SignUp extends Component<SignUpProps, SignUpState> {
    state: SignUpState = {
        name: "",
        step: "name",
        errorPrompt: "",
        confirmSecretKey: "",
    };

    // signInWithPrivateKey = async () => {
    //     this.props.emit({
    //         type: "SignInEvent",
    //         ctx,
    //     });
    //     localStorage.setItem("SignInState", "local");
    //     await LocalPrivateKeyController.setKey("blowater", ctx.privateKey);
    // };

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
            // Replace this alert with actual form submission logic
            if (this.checkSecretKeyComplete()) {
                alert("Form submitted");
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
        const { confirmSecretKey } = this.state;
        // Check if the last 4 characters of the secret key match the input
        if (confirmSecretKey.length !== 4) return false;
        const { bech32 } = ctx.privateKey;
        return bech32.endsWith(confirmSecretKey);
    };

    handleNameChange = (event: Event) => {
        if (this.checkNameComplete()) this.setState({ errorPrompt: "" });
        this.setState({ name: (event.target as HTMLInputElement).value });
    };

    renderStep() {
        const { step, name } = this.state;
        switch (step) {
            case "name":
                return (
                    <Fragment>
                        <div class={`text-3xl w-full text-center font-bold py-5`}>Sign Up</div>
                        <div class={`text-md w-full text-center`}>What should we call you?</div>
                        <input
                            class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                            placeholder="e.g. Bob"
                            type="text"
                            value={name}
                            onInput={this.handleNameChange}
                        />
                        <div class={`text-red-500`}>{this.state.errorPrompt}</div>
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
            case "backup":
                // Backup step elements
                return (
                    <Fragment>
                        <div class={`text-3xl w-full text-center font-bold py-5`}>Backup your keys</div>
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
                                Your secret key is like your password, if anyone gets a hold of it they will
                                have complete control over your account
                            </div>
                        </div>
                        <div>
                            <div class={`text-lg font-semibold`}>Secret Key</div>
                            <TextField text={ctx.privateKey.bech32} />
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
            case "verify":
                // Verify step elements
                return (
                    <Fragment>
                        <div class={`text-3xl w-full text-center font-bold py-5`}>Confirm secret key</div>
                        <div>
                            <div class={`text-lg font-semibold`}>
                                Last four letters of secret key
                            </div>
                            <input
                                class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                                placeholder="xxxx"
                                type="text"
                                value={this.state.confirmSecretKey}
                                onInput={(e) =>
                                    this.setState({ confirmSecretKey: (e.target as HTMLInputElement).value })}
                            />
                            <div>
                                This is the key to access your account, keep it secret.
                            </div>
                        </div>
                        <div class={`text-red-500`}>{this.state.errorPrompt}</div>
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
            default:
                return null;
        }
    }

    render() {
        return (
            <div
                class={`flex flex-col justify-start items-center w-full h-screen bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}]`}
            >
                <div class={`flex flex-col gap-2 w-[30rem] p-5`}>
                    <div class={`flex justify-center items-center w-full`}>
                        <img src="logo.webp" alt="Blowater Logo" class={`w-20 h-20`} />
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
    const styles = {
        container: `relative ${InputClass} flex p-0`,
        pre: `whitespace-pre flex-1 overflow-x-auto px-4 py-3`,
        copyButton: `w-14 ${CenterClass}`,
    };

    const asterisksText = (text: string) => {
        // replate end of string with asterisks
        return text.slice(0, -50) + "*".repeat(50);
    };

    return (
        <div class={styles.container}>
            <pre class={styles.pre}>{asterisksText(props.text)}</pre>
            <div class={styles.copyButton}>
                <CopyButton text={props.text} />
            </div>
        </div>
    );
}
