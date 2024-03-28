import { createRef, Fragment, h } from "https://esm.sh/preact@10.17.1";
import {
    CenterClass,
    DividerClass,
    inputBorderClass,
    InputClass,
    LinearGradientsClass,
    NoOutlineClass,
} from "./components/tw.ts";
import { ProfileData } from "../features/profile.ts";
import {
    DividerBackgroundColor,
    ErrorColor,
    HintLinkColor,
    HintTextColor,
    HoverButtonBackgroundColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";
import { Component, ComponentChildren } from "https://esm.sh/preact@10.11.3";
import { emitFunc } from "../event-bus.ts";
import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";

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
    cutomFields: ProfileData | undefined;
    newFieldKeyError: string;
};

export class EditProfile extends Component<Props, State> {
    state: Readonly<State> = {
        newFieldKeyError: "",
        cutomFields: undefined,
        profileData: undefined,
    };

    newFieldKey = createRef<HTMLInputElement>();
    newFieldValue = createRef<HTMLInputElement>();

    componentDidMount(): void {
        console.log("EditProfile - componentDidMount");
        const filterObject = (obj: ProfileData, keysToKeep: string[]) => {
            return Object.keys(obj)
                .filter((key) => !keysToKeep.includes(key))
                .reduce((newObj: ProfileData, key) => {
                    newObj[key] = obj[key];
                    return newObj;
                }, {});
        };
        const keysToFilter = ["name", "picture", "banner", "about", "website"];

        this.setState({
            profileData: this.props.profile,
            cutomFields: filterObject(this.props.profile, keysToFilter),
        });
    }

    componentDidUpdate(previousProps: Readonly<Props>, previousState: Readonly<State>, snapshot: any): void {
        console.log("EditProfile - componentDidUpdate", previousProps, previousState, snapshot);
    }

    render(props: Props, state: State) {
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
                    src={`${this.state.profileData?.picture}`}
                    class="w-20 h-20 rounded-full mx-auto border-[3px] border-white
                    transform -translate-y-10"
                />
                <div class={`my-4 p-4 rounded-lg  ${NoOutlineClass} ${inputBorderClass} `}>
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        name
                    </h3>
                    <input
                        placeholder="Please input your name"
                        value={state.profileData?.name}
                        name="name"
                        type="text"
                        class={`${InputClass}`}
                    />
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Profile Image URL
                    </h3>
                    <input
                        placeholder="Please input your picture url"
                        value={state.profileData?.picture}
                        name="picture"
                        type="text"
                        class={`${InputClass}`}
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
                        placeholder="Please input your banner url"
                        value={state.profileData?.banner}
                        name="banner"
                        type="text"
                        class={`${InputClass}`}
                    />
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        About
                    </h3>
                    <input
                        placeholder="Please input your about"
                        value={state.profileData?.about}
                        name="about"
                        type="text"
                        class={`${InputClass}`}
                    />
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        website
                    </h3>
                    <input
                        placeholder="Please input your website"
                        value={state.profileData?.website}
                        name="website"
                        type="text"
                        class={`${InputClass}`}
                    />
                </div>

                <div class={`my-4 p-4 rounded-lg  ${NoOutlineClass} ${inputBorderClass} `}>
                    <p class={`text-[${PrimaryTextColor}] font-bold text-sm`}>Custom Fields</p>
                    {Object.entries(state.cutomFields || {}).map(([key, value]) => (
                        <Fragment>
                            <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                                {key}
                            </h3>
                            <textarea
                                placeholder="Please input your value"
                                value={value}
                                name={key}
                                onInput={(e) => this.onInput(e, key)}
                                type="text"
                                class={`${InputClass}`}
                            />
                        </Fragment>
                    ))}
                    <p class={`text-[${PrimaryTextColor}] font-bold text-sm`}>Custom Fields</p>
                    <span class={`text-[${HintTextColor}] text-sm`}>
                        Create your own custom fields, anything goes!
                    </span>
                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Field name
                    </h3>
                    <input
                        ref={this.newFieldKey}
                        placeholder="e.g. hobbies"
                        type="text"
                        class={`${InputClass}`}
                    />
                    <span class={`text-sm text-[${ErrorColor}]`}>{this.state.newFieldKeyError}</span>

                    <h3 class={`text-[${PrimaryTextColor}] mt-8`}>
                        Field value
                    </h3>
                    <input
                        ref={this.newFieldValue}
                        placeholder="e.g. Sports, Reading, Design"
                        onInput={() => console.log("input")}
                        type="text"
                        class={`${InputClass}`}
                    >
                    </input>

                    <button
                        class={`w-full mt-6 p-3 rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] bg-[${DividerBackgroundColor}] hover:bg-[${HoverButtonBackgroundColor}] ${CenterClass}`}
                        onClick={this.addField}
                    >
                        Add Field
                    </button>
                </div>

                <button
                    class={`w-full p-3 rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l`}
                    type="submit"
                >
                    Update Profile
                </button>
            </form>
        );
    }

    onInput = (e: h.JSX.TargetedEvent<HTMLTextAreaElement, Event>, key?: string) => {
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

    onSubmit = () => {
        this.props.emit({
            type: "SaveProfile",
            ctx: this.props.ctx,
            profile: this.state.profileData,
        });
    };
}
