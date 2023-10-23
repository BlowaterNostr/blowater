/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.17.1";
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
    HintLinkColor,
    HintTextColor,
    HoverButtonBackgroudColor,
    PrimaryTextColor,
} from "./style/colors.ts";
import { Component, ComponentChildren, Ref } from "https://esm.sh/preact@10.11.3";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { ProfileGetter } from "./search.tsx";

export type MyProfileUpdate =
    | Edit
    | Save
    | EditNewProfileFieldKey
    | EditNewProfileFieldValue
    | InsertNewProfileField;

export type Edit = {
    type: "EditMyProfile";
    profile: ProfileData;
};

type Save = {
    type: "SaveMyProfile";
    profile: ProfileData;
};

export type EditNewProfileFieldKey = {
    type: "EditNewProfileFieldKey";
    key: string;
};

export type EditNewProfileFieldValue = {
    type: "EditNewProfileFieldValue";
    value: string;
};

export type InsertNewProfileField = {
    type: "InsertNewProfileField";
};

type Props = {
    publicKey: PublicKey;
    profileGetter: ProfileGetter;
};

type profileItem = {
    key: string;
    value?: string;
    hint?: ComponentChildren;
};

export class EditProfile extends Component<Props, {}> {
    styles = {
        banner: {
            container: tw`h-72 w-full rounded-lg relative`,
            avatar:
                tw`w-24 h-24 m-auto absolute top-64 left-1/2 box-border border-2 border-[${PrimaryTextColor}] -translate-x-2/4`,
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
            title: tw`text-[${PrimaryTextColor}] font-blod text-sm`,
            text: tw`text-[${HintTextColor}] text-sm`,
        },
    };
    profileItems: profileItem[] = [];
    profile: ProfileData | undefined;

    componentDidMount() {
        const { publicKey, profileGetter } = this.props;
        this.profile = profileGetter.getProfilesByPublicKey(publicKey)?.profile;
        this.profileItems = [
            {
                key: "Name",
                value: this.profile?.name,
            },
            {
                key: "Picture",
                value: this.profile?.picture,
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
                key: "About",
                value: this.profile?.about,
            },
            {
                key: "Website",
                value: this.profile?.website,
            },
            {
                key: "Banner",
                value: this.profile?.banner,
            },
        ];

        if (this.profile) {
            for (const [key, value] of Object.entries(this.profile)) {
                if (["name", "picture", "about", "website", "banner"].includes(key) || !value) {
                    continue;
                }

                this.profileItems.push({
                    key: key,
                    value: value,
                });
            }
        }
    }

    render() {
        const banner = this.profile?.banner
            ? (
                <div
                    class={this.styles.banner.container}
                    style={{
                        background: `url(${
                            this.profile?.banner ? this.profile.banner : "default-bg.png"
                        }) no-repeat center center / cover`,
                    }}
                >
                    <Avatar
                        picture={this.profile?.picture}
                        class={this.styles.banner.avatar}
                    />
                </div>
            )
            : (
                <Avatar
                    picture={this.profile?.picture}
                    class={this.styles.avatar}
                />
            );

        const items = this.profileItems.map((item) => (
            <Fragment>
                <h3 class={this.styles.field.title} style={{textTransform: "capitalize"}}>
                    {item.key}
                </h3>
                <textarea
                    placeholder={item.key}
                    rows={item.value?.split("\n")?.length || 1}
                    value={item.value}
                    onInput={(e) => {
                        const lines = e.currentTarget.value.split("\n");
                        e.currentTarget.setAttribute(
                            "rows",
                            `${lines.length}`,
                        );
                    }}
                    type="text"
                    class={this.styles.field.input}
                >
                </textarea>
                {item.hint}
            </Fragment>
        ));

        return (
            <Fragment>
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
                    placeholder="e.g. hobbies"
                    type="text"
                    class={this.styles.field.input}
                />

                <h3 class={this.styles.field.title}>
                    Field value
                </h3>
                <textarea
                    placeholder="e.g. Sports, Reading, Design"
                    // rows={item.value?.split("\n")?.length || 1}
                    // value={item.value}
                    onInput={(e) => {
                        const lines = e.currentTarget.value.split("\n");
                        e.currentTarget.setAttribute(
                            "rows",
                            `${lines.length}`,
                        );
                    }}
                    type="text"
                    class={this.styles.field.input}
                >
                </textarea>

                <button class={this.styles.addButton}>Add Field</button>

                <div class={tw`${DividerClass}`}></div>

                <button class={this.styles.submitButton}>Update Profile</button>
            </Fragment>
        );
    }
}
