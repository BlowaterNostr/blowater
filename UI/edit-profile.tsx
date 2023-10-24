/** @jsx h */
import { createRef, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
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
    HoverButtonBackgroudColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";
import { Component, ComponentChildren } from "https://esm.sh/preact@10.11.3";
import { ProfileGetter } from "./search.tsx";
import { NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { emitFunc } from "../event-bus.ts";

export type SaveProfile = {
    type: "SaveProfile";
    profile: ProfileData;
    ctx: NostrAccountContext;
};

type profileItem = {
    key: string;
    value?: string;
    hint?: ComponentChildren;
};

type Props = {
    ctx: NostrAccountContext;
    profileGetter: ProfileGetter;
    emit: emitFunc<SaveProfile>;
};

type State = {
    profile: ProfileData | undefined;
    newFieldKeyError: string;
};

export class EditProfile extends Component<Props, State> {
    styles = {
        container: tw`py-4 bg-[${SecondaryBackgroundColor}]`,
        banner: {
            container: tw`h-72 w-full rounded-lg mb-20 relative`,
            avatar:
                tw`w-24 h-24 m-auto absolute top-60 left-1/2 box-border border-2 border-[${PrimaryTextColor}] -translate-x-2/4`,
        },
        avatar: tw`w-24 h-24 m-auto box-border border-2 border-[${PrimaryTextColor}]`,
        field: {
            title: tw`text-[${PrimaryTextColor}] mt-8`,
            input: tw`${InputClass}`,
            hint: {
                text: tw`text-sm text-[${HintTextColor}]`,
                link: tw`text-[${HintLinkColor}]`,
            },
        },
        addButton:
            tw`w-full mt-6 p-3 rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] bg-[${DividerBackgroundColor}] hover:bg-[${HoverButtonBackgroudColor}] ${CenterClass}`,
        submitButton:
            tw`w-full p-3 rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l`,
        divider: tw`${DividerClass}`,
        custom: {
            title: tw`text-[${PrimaryTextColor}] font-bold text-sm`,
            text: tw`text-[${HintTextColor}] text-sm`,
            error: tw`text-sm text-[${ErrorColor}]`,
        },
    };

    componentDidMount() {
        const { ctx, profileGetter } = this.props;
        this.setState({
            profile: profileGetter.getProfilesByPublicKey(ctx.publicKey)?.profile,
        });
    }

    shouldComponentUpdate(_: Readonly<Props>, nextState: Readonly<State>, __: any): boolean {
        return JSON.stringify(this.state.profile) != JSON.stringify(nextState.profile);
    }

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
                profile: {
                    ...this.state.profile,
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
            profile: {
                ...this.state.profile,
                [this.newFieldKey.current.value]: this.newFieldValue.current.value,
            },
            newFieldKeyError: "",
        });

        this.newFieldKey.current.value = "";
        this.newFieldValue.current.value = "";
    };

    onSubmit = () => {
        if (!this.state.profile) {
            return;
        }

        this.props.emit({
            type: "SaveProfile",
            ctx: this.props.ctx,
            profile: this.state.profile,
        });
    };

    render() {
        const profileItems: profileItem[] = [
            {
                key: "name",
                value: this.state.profile?.name,
            },
            {
                key: "banner",
                value: this.state.profile?.banner,
            },
            {
                key: "picture",
                value: this.state.profile?.picture,
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
                value: this.state.profile?.about,
            },
            {
                key: "website",
                value: this.state.profile?.website,
            },
        ];

        if (this.state.profile) {
            for (const [key, value] of Object.entries(this.state.profile)) {
                if (["name", "picture", "about", "website", "banner"].includes(key) || !value) {
                    continue;
                }

                profileItems.push({
                    key: key,
                    value: value,
                });
            }
        }

        const banner = this.state.profile?.banner
            ? (
                <div
                    class={this.styles.banner.container}
                    style={{
                        background: `url(${
                            this.state.profile?.banner ? this.state.profile.banner : "default-bg.png"
                        }) no-repeat center center / cover`,
                    }}
                >
                    <Avatar
                        picture={this.state.profile?.picture}
                        class={this.styles.banner.avatar}
                    />
                </div>
            )
            : (
                <Avatar
                    picture={this.state.profile?.picture}
                    class={this.styles.avatar}
                />
            );

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
                {banner}
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

                <div class={tw`${DividerClass}`}></div>

                <button class={this.styles.submitButton} onClick={this.onSubmit}>Update Profile</button>
            </div>
        );
    }
}
