import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";

import { emitFunc } from "../event-bus.ts";
import { CopyButton } from "./components/copy-button.tsx";
import { CenterClass, InputClass } from "./components/tw.ts";
import { DividerBackgroundColor, PrimaryTextColor, SecondaryTextColor } from "./style/colors.ts";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { LocalPrivateKeyController } from "./sign-in.ts";
import { PlaceholderColor } from "./style/colors.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { PrivateKey } from "../../libs/nostr.ts/key.ts";
import { setSignInState } from "./sign-in.ts";
import { SignInEvent } from "./sign-in.ts";
import { SaveProfile } from "./edit-profile.tsx";
import { setState } from "./_helper.ts";

interface Props {
    emit: emitFunc<SaveProfile | SignInEvent>;
}

interface State {
    step: {
        type: "onboarding";
    } | {
        type: "signin";
        private_key: string;
    } | {
        type: "name";
        name: string;
    } | {
        type: "backup";
        name: string;
        new_private_key: PrivateKey;
    } | {
        type: "verify";
        name: string;
        new_private_key: PrivateKey;
        last_4_digits_of_private_key: string;
    };
    errorPrompt: string;
}

export class SignIn extends Component<Props, State> {
    state: State = {
        step: {
            type: "onboarding",
        },
        errorPrompt: "",
    };

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

    renderStep() {
        const { step } = this.state;
        switch (step.type) {
            case "onboarding":
                return this.setpOnboarding();
            case "signin":
                return this.stepSignIn(step.private_key);
            case "name":
                return this.stepName(step.name);
            case "backup":
                return this.stepBackup(step.new_private_key, step.name);
            case "verify":
                return this.stepVerify(step.new_private_key, step.last_4_digits_of_private_key, step.name);
        }
    }

    setpOnboarding = () => {
        return (
            <Fragment>
                <div class={`text-4xl w-full text-center font-bold`}>Blowater</div>
                <div class={`text-md w-full text-center ${SecondaryTextColor}`}>
                    A delightful Nostr client that focuses on DM
                </div>
                <button
                    onClick={() => this.setState({ step: { type: "signin", private_key: "" } })}
                    class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                >
                    Alreay have an account
                </button>
                <button
                    onClick={() =>
                        this.setState({
                            step: {
                                type: "name",
                                name: "",
                            },
                        })}
                    class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                >
                    Sign Up
                </button>
            </Fragment>
        );
    };

    stepSignIn = (private_key: string) => {
        return (
            <Fragment>
                <div class={`text-3xl w-full text-center font-bold`}>Sign In</div>
                <div class={`text-md w-full text-center`}>Please enter your private key</div>
                <input
                    class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                    placeholder="nsec1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    type="password"
                    autofocus
                    onInput={(e) => {
                        this.setState({
                            errorPrompt: "",
                            step: {
                                type: "signin",
                                private_key: e.currentTarget.value,
                            },
                        });
                    }}
                />
                <div class={`text-red-500`}>{this.state.errorPrompt}</div>
                <button
                    onClick={() => this.signInWithPrivateKey(private_key)}
                    class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                >
                    Sign In
                </button>
                <button
                    onClick={() =>
                        this.setState({
                            step: {
                                type: "onboarding",
                            },
                        })}
                    class={`border-none bg-transparent text-[#FF3A5E] mt-2 focus:outline-none focus-visible:outline-none`}
                >
                    Go back
                </button>
            </Fragment>
        );
    };

    stepName = (name: string) => {
        return (
            <Fragment>
                <div class={`text-3xl w-full text-center font-bold`}>Sign Up</div>
                <div class={`text-md w-full text-center`}>What should we call you?</div>
                <input
                    class={`w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}]`}
                    placeholder="e.g. Bob"
                    type="text"
                    value={name}
                    onInput={(event: h.JSX.TargetedEvent<HTMLInputElement, Event>) => {
                        this.setState({
                            step: {
                                type: "name",
                                name: event.currentTarget.value,
                            },
                        });
                    }}
                />
                <div class={`text-red-500`}>{this.state.errorPrompt}</div>
                <button
                    onClick={() => {
                        if (name.length > 0) {
                            this.setState({
                                step: {
                                    type: "backup",
                                    name: name,
                                    new_private_key: PrivateKey.Generate(),
                                },
                            });
                        } else {
                            this.setState({ errorPrompt: "Name is required" });
                        }
                    }}
                    class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l ${
                        name.length > 0 ? "" : "opacity-50 cursor-not-allowed"
                    }`}
                >
                    Next
                </button>
            </Fragment>
        );
    };

    stepBackup = (new_private_key: PrivateKey, name: string) => {
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
                    <TextField
                        text={new_private_key.bech32}
                    />
                    <div>This is the key to access your account, keep it secret.</div>
                </div>

                <button
                    onClick={() => {
                        this.setState({
                            step: {
                                type: "verify",
                                name: name,
                                new_private_key,
                                last_4_digits_of_private_key: "",
                            },
                        });
                    }}
                    class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                >
                    I have saved my secret key
                </button>
            </Fragment>
        );
    };

    stepVerify = (new_private_key: PrivateKey, last_4_digits_of_private_key: string, name: string) => {
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
                        value={last_4_digits_of_private_key}
                        onInput={(e) => {
                            this.setState({
                                step: {
                                    type: "verify",
                                    last_4_digits_of_private_key: e.currentTarget.value,
                                    name,
                                    new_private_key: new_private_key,
                                },
                            });
                        }}
                    />
                    <div>
                        This is the key to access your account, keep it secret.
                    </div>
                </div>
                <div class={`text-red-500`}>{this.state.errorPrompt}</div>
                <button
                    onClick={() => signInWithNewPrivateKey(name, new_private_key, this.props.emit)}
                    class={`w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l ${
                        this.checkSecretKeyComplete(last_4_digits_of_private_key, new_private_key)
                            ? ""
                            : "opacity-50 cursor-not-allowed"
                    }`}
                >
                    Confirm
                </button>
                <button
                    onClick={() =>
                        this.setState({
                            step: {
                                type: "backup",
                                name,
                                new_private_key: new_private_key,
                            },
                        })}
                    class={`border-none bg-transparent text-[#FF3A5E] mt-2 focus:outline-none focus-visible:outline-none`}
                >
                    Go back...I didn't save it
                </button>
            </Fragment>
        );
    };

    signInWithPrivateKey = async (private_key: string | PrivateKey) => {
        let pri;
        if (private_key instanceof PrivateKey) {
            pri = private_key;
        } else {
            pri = PrivateKey.FromString(private_key);
            if (pri instanceof Error) {
                await setState(this, {
                    errorPrompt: pri.message,
                });
                return;
            }
        }
        const ctx = InMemoryAccountContext.New(pri);
        await this.props.emit({
            type: "SignInEvent",
            ctx,
        });
        setSignInState("local");
        await LocalPrivateKeyController.setKey("blowater", pri);
    };

    checkSecretKeyComplete = (last_4_digits_of_private_key: string, prikey: PrivateKey) => {
        if (last_4_digits_of_private_key.length !== 4) return false;
        return prikey.bech32.endsWith(last_4_digits_of_private_key);
    };
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

async function signInWithNewPrivateKey(
    name: string,
    signUpSecretKey: PrivateKey,
    emit: emitFunc<SignInEvent | SaveProfile>,
) {
    await emit({
        type: "SignInEvent",
        ctx: InMemoryAccountContext.New(signUpSecretKey),
    });
    await emit({
        type: "SaveProfile",
        ctx: InMemoryAccountContext.New(signUpSecretKey),
        profile: {
            name,
            picture: `https://robohash.org/${name}.png`,
        },
    });
    setSignInState("local");
    await LocalPrivateKeyController.setKey("blowater", signUpSecretKey);
}
