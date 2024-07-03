import { createRef, h } from "preact";
import { ProfileData } from "../features/profile.ts";
import {
    DividerBackgroundColor,
    HintLinkColor,
    HintTextColor,
    PlaceholderColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";
import { Component } from "preact";
import { emitFunc } from "../event-bus.ts";
import { NostrAccountContext } from "@blowater/nostr-sdk";
import { UserIcon } from "./icons/user-icon.tsx";

export type SaveProfile = {
    type: "SaveProfile";
    profile: ProfileData | undefined;
    ctx: NostrAccountContext;
};

type Props = {
    ctx: NostrAccountContext;
    profile: ProfileData;
    emit: emitFunc<SaveProfile>;
};

type State = {
    profileData: ProfileData | undefined;
    newFieldKeyError: string;
};

export class EditProfile extends Component<Props, State> {
    state: Readonly<State> = {
        newFieldKeyError: "",
        profileData: undefined,
    };

    newFieldKey = createRef<HTMLInputElement>();
    newFieldValue = createRef<HTMLInputElement>();

    componentDidMount(): void {
        this.setState({
            profileData: this.props.profile,
        });
    }

    render(_props: Props, state: State) {
        return (
            <form class={`py-4 bg-[${SecondaryBackgroundColor}]`} onSubmit={this.onSubmit}>
                <img
                    src={`${
                        this.state.profileData?.banner ||
                        "https://images.unsplash.com/photo-1468581264429-2548ef9eb732"
                    }`}
                    class="w-full h-[300px] object-cover rounded-lg"
                />
                <img
                    src={`${this.state.profileData?.picture || "/logo.webp"}`}
                    class="w-20 h-20 rounded-full mx-auto border-[3px] border-white
                    object-cover
                    transform -translate-y-10 bg-white"
                />
                <div
                    class={`my-4 p-4 rounded-2xl border-[2px] border-[${DividerBackgroundColor}] `}
                >
                    <div class={`flex justify-start items-center gap-2`}>
                        <UserIcon class="w-8 h-8 text-[#FF772B]" />
                        <div
                            class={`text-[${PrimaryTextColor}] text-[1.3125rem] font-not-italic font-700 leading-[1.5rem] tracking--0.21px`}
                        >
                            Profile
                        </div>
                    </div>
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Name
                    </h3>
                    <input
                        value={state.profileData?.name}
                        name="name"
                        onInput={(e) => this.onInput(e, "name")}
                        type="text"
                        class={`focus:outline-none focus:border-white w-full px-4 py-3 rounded-lg resize-y bg-transparent  border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}] text-[${PrimaryTextColor}] `}
                    />
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Profile Image URL
                    </h3>
                    <input
                        value={state.profileData?.picture}
                        name="picture"
                        onInput={(e) => this.onInput(e, "picture")}
                        type="text"
                        class={`focus:outline-none focus:border-white w-full px-4 py-3 rounded-lg resize-y bg-transparent  border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}] text-[${PrimaryTextColor}] `}
                    />
                    <span class={`text-sm text-[${HintTextColor}]`}>
                        You can upload your images on websites like{" "}
                        <a class={`text-[${HintLinkColor}]`} href="https://nostr.build/" target="_blank">
                            nostr.build
                        </a>
                    </span>
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Banner Image URL
                    </h3>
                    <input
                        value={state.profileData?.banner}
                        name="banner"
                        onInput={(e) => this.onInput(e, "banner")}
                        type="text"
                        class={`focus:outline-none focus:border-white w-full px-4 py-3 rounded-lg resize-y bg-transparent  border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}] text-[${PrimaryTextColor}]`}
                    />
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        About
                    </h3>
                    <input
                        placeholder={"tell us about yourself"}
                        value={state.profileData?.about}
                        name="about"
                        onInput={(e) => this.onInput(e, "about")}
                        type="text"
                        class={`focus:outline-none focus:border-white w-full px-4 py-3 rounded-lg resize-y bg-transparent  border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}] text-[${PrimaryTextColor}] `}
                    />
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Website
                    </h3>
                    <input
                        value={state.profileData?.website}
                        name="website"
                        onInput={(e) => this.onInput(e, "website")}
                        type="text"
                        class={`focus:outline-none focus:border-white w-full px-4 py-3 rounded-lg resize-y bg-transparent  border-[2px] border-[${DividerBackgroundColor}] placeholder-[${PlaceholderColor}] text-[${PrimaryTextColor}]`}
                    />
                </div>

                <button
                    class={`w-full p-3 rounded-lg  text-[${PrimaryTextColor}] flex items-center justify-center bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`}
                    type="submit"
                >
                    Update Profile
                </button>
            </form>
        );
    }

    onInput = (e: h.JSX.TargetedEvent<HTMLTextAreaElement | HTMLInputElement, Event>, key?: string) => {
        const lines = e.currentTarget.value.split("\n");
        e.currentTarget.setAttribute(
            "rows",
            `${lines.length}`,
        );
        if (key) {
            const value = e.currentTarget.value;
            this.setState({
                profileData: {
                    ...this.state.profileData,
                    [key]: value,
                },
            });
        }
    };

    addField = () => {
        if (!this.newFieldKey.current || !this.newFieldValue.current) {
            return;
        }

        if (this.newFieldKey.current.value.trim() == "") {
            this.setState({
                newFieldKeyError: "Key is required.",
            });
            return;
        }

        console.log(`Adding field ${this.newFieldKey.current.value}`);
        console.log(`Adding field ${this.newFieldValue.current.value}`);

        this.setState({
            profileData: {
                ...this.state.profileData,
                [this.newFieldKey.current.value]: this.newFieldValue.current.value,
            },
            newFieldKeyError: "",
        });

        this.newFieldKey.current.value = "";
        this.newFieldValue.current.value = "";
    };

    onSubmit = (e: h.JSX.TargetedEvent) => {
        e.preventDefault();
        this.props.emit({
            type: "SaveProfile",
            ctx: this.props.ctx,
            profile: this.state.profileData,
        });
    };
}
