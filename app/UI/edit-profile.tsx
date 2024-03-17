/** @jsx h */
import { createRef, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { Avatar } from "./components/avatar.tsx";
import {
    CenterClass,
    DividerClass,
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
import { ProfileGetter } from "./search.tsx";
import { emitFunc } from "../event-bus.ts";
import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { robohash } from "./relay-detail.tsx";

export type SaveProfile = {
    type: "SaveProfile";
    profile: ProfileData | undefined;
    ctx: NostrAccountContext;
};

type profileItem = {
    key: string;
    value?: string;
    hint?: ComponentChildren;
};

type Props = {
    ctx: NostrAccountContext;
    profile: ProfileData | undefined;
    emit: emitFunc<SaveProfile>;
};

type State = {
    profileData: ProfileData;
    newFieldKeyError: string;
};

export class EditProfile extends Component<Props, State> {
    state: Readonly<State> = {
        newFieldKeyError: "",
        profileData: {},
    };

    styles = {
        container: `py-4 bg-[${SecondaryBackgroundColor}]`,
        banner: {
            container: `h-72 w-full rounded-lg mb-20 relative`,
        },
        field: {
            title: `text-[${PrimaryTextColor}] mt-8`,
            input: `${InputClass}`,
            hint: {
                text: `text-sm text-[${HintTextColor}]`,
                link: `text-[${HintLinkColor}]`,
            },
        },
        addButton:
            `w-full mt-6 p-3 rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] bg-[${DividerBackgroundColor}] hover:bg-[${HoverButtonBackgroundColor}] ${CenterClass}`,
        submitButton:
            `w-full p-3 rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l`,
        divider: `${DividerClass}`,
        custom: {
            title: `text-[${PrimaryTextColor}] font-bold text-sm`,
            text: `text-[${HintTextColor}] text-sm`,
            error: `text-sm text-[${ErrorColor}]`,
        },
    };

    newFieldKey = createRef<HTMLInputElement>();
    newFieldValue = createRef<HTMLTextAreaElement>();

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

    render() {
        const profileItems: profileItem[] = [
            {
                key: "name",
                value: this.state.profileData.name || this.props.profile?.name,
            },
            {
                key: "banner",
                value: this.state.profileData.banner || this.props.profile?.banner,
            },
            {
                key: "picture",
                value: this.state.profileData.picture || this.props.profile?.picture,
                hint: (
                    <span class={this.styles.field.hint.text}>
                        You can upload your images on websites like{" "}
                        <a class={this.styles.field.hint.link} href="https://nostr.build/" target="_blank">
                            nostr.build
                        </a>
                    </span>
                ),
            },
            {
                key: "about",
                value: this.state.profileData.about || this.props.profile?.about,
            },
            {
                key: "website",
                value: this.state.profileData.website || this.props.profile?.website,
            },
        ];

        const items = profileItems.map((item) => (
            <Fragment>
                <h3 class={this.styles.field.title} style={{ textTransform: "capitalize" }}>
                    {item.key}
                </h3>
                <textarea
                    placeholder={item.key}
                    rows={item.value?.split("\n")?.length || 1}
                    value={item.value}
                    onInput={(e) => this.onInput(e, item.key)}
                    type="text"
                    class={this.styles.field.input}
                >
                </textarea>
                {item.hint}
            </Fragment>
        ));

        return (
            <div class={this.styles.container}>
                {items}

                <div class={this.styles.divider}></div>
                <p class={this.styles.custom.title}>Custom Fields</p>
                <span class={this.styles.custom.text}>
                    Create your own custom fields, anything goes!
                </span>

                <h3 class={this.styles.field.title}>
                    Field name
                </h3>
                <input
                    ref={this.newFieldKey}
                    placeholder="e.g. hobbies"
                    type="text"
                    class={this.styles.field.input}
                />
                <span class={this.styles.custom.error}>{this.state.newFieldKeyError}</span>

                <h3 class={this.styles.field.title}>
                    Field value
                </h3>
                <textarea
                    ref={this.newFieldValue}
                    placeholder="e.g. Sports, Reading, Design"
                    rows={1}
                    onInput={(e) => this.onInput(e)}
                    type="text"
                    class={this.styles.field.input}
                >
                </textarea>

                <button class={this.styles.addButton} onClick={this.addField}>Add Field</button>

                <div class={`${DividerClass}`}></div>

                <button class={this.styles.submitButton} onClick={this.onSubmit}>Update Profile</button>
            </div>
        );
    }
}
