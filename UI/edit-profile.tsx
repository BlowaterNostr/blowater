/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Avatar } from "./components/avatar.tsx";
import { EventEmitter } from "../event-bus.ts";
import {
    ButtonClass,
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
    HintLinkColor,
    HintTextColor,
    HoverButtonBackgroudColor,
    PlaceholderColor,
    PrimaryTextColor,
} from "./style/colors.ts";

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

export function EditProfile(props: {
    eventEmitter: EventEmitter<MyProfileUpdate>;
    myProfile: ProfileData | undefined;
    newProfileField: {
        key: string;
        value: string;
    };
}) {
    return (
        <div class={tw`py-[3rem]`}>
            {props.myProfile?.banner
                ? (
                    <div
                        class={tw`h-[18.75rem] w-full rounded-lg relative`}
                        style={{
                            background: `url(${
                                props.myProfile?.banner ? props.myProfile.banner : "default-bg.png"
                            }) no-repeat center center / cover`,
                        }}
                    >
                        <Avatar
                            picture={props.myProfile?.picture}
                            class={tw`w-[6.25rem] h-[6.25rem] m-auto absolute top-[15.62rem] left-[50%] box-border border-[3px] border-[${PrimaryTextColor}]`}
                            style={{
                                transform: "translate(-50%, 0%)",
                            }}
                        />
                    </div>
                )
                : (
                    <Avatar
                        picture={props.myProfile?.picture}
                        class={tw`w-[6.25rem] h-[6.25rem] m-auto box-border border-[3px] border-[${PrimaryTextColor}]`}
                    />
                )}
            <h3 class={tw`text-[${PrimaryTextColor}] mt-[4.5rem]`}>
                Name
            </h3>
            <textarea
                placeholder="Name"
                rows={props.myProfile?.name?.split("\n")?.length || 1}
                value={props.myProfile?.name}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditMyProfile",
                        profile: {
                            name: e.currentTarget.value,
                        },
                    });
                    const lines = e.currentTarget.value.split("\n");
                    e.currentTarget.setAttribute(
                        "rows",
                        `${lines.length}`,
                    );
                }}
                type="text"
                class={tw`${InputClass}`}
            >
            </textarea>
            <h3 class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                Picture
            </h3>
            <textarea
                placeholder="Profile Image URL"
                rows={props.myProfile?.picture?.split("\n")?.length || 1}
                value={props.myProfile?.picture}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditMyProfile",
                        profile: {
                            picture: e.currentTarget.value,
                        },
                    });
                    const lines = e.currentTarget.value.split("\n");
                    e.currentTarget.setAttribute(
                        "rows",
                        `${lines.length}`,
                    );
                }}
                type="text"
                class={tw`${InputClass}`}
            >
            </textarea>
            <span class={tw`text-[0.875rem] text-[${HintTextColor}]`}>
                You can upload your images on websites like{" "}
                <a class={tw`text-[${HintLinkColor}]`} href="https://nostr.build/" target="_blank">
                    nostr.build
                </a>
            </span>
            <h3 class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                About
            </h3>
            <textarea
                placeholder="About"
                rows={props.myProfile?.about?.split("\n")?.length || 1}
                value={props.myProfile?.about}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditMyProfile",
                        profile: {
                            about: e.currentTarget.value,
                        },
                    });
                    const lines = e.currentTarget.value.split("\n");
                    e.currentTarget.setAttribute(
                        "rows",
                        `${lines.length}`,
                    );
                }}
                type="text"
                class={tw`${InputClass}`}
            >
            </textarea>
            <h3 class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                Website
            </h3>
            <textarea
                placeholder="Website"
                rows={props.myProfile?.website?.split("\n")?.length || 1}
                value={props.myProfile?.website}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditMyProfile",
                        profile: {
                            website: e.currentTarget.value,
                        },
                    });
                    const lines = e.currentTarget.value.split("\n");
                    e.currentTarget.setAttribute(
                        "rows",
                        `${lines.length}`,
                    );
                }}
                type="text"
                class={tw`${InputClass}`}
            >
            </textarea>
            <h3 class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                Banner
            </h3>
            <textarea
                placeholder="Banner Image Url"
                rows={props.myProfile?.banner?.split("\n")?.length || 1}
                value={props.myProfile?.banner}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditMyProfile",
                        profile: {
                            banner: e.currentTarget.value,
                        },
                    });
                    const lines = e.currentTarget.value.split("\n");
                    e.currentTarget.setAttribute(
                        "rows",
                        `${lines.length}`,
                    );
                }}
                type="text"
                class={tw`${InputClass}`}
            >
            </textarea>
            {props.myProfile
                ? Object.entries(props.myProfile).map(([key, value]) => {
                    if (["name", "picture", "about", "website", "banner"].includes(key) || !value) {
                        return undefined;
                    }

                    return (
                        <Fragment>
                            <h3 class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                                {key}
                            </h3>
                            <textarea
                                placeholder={key}
                                rows={value.toString().split("\n").length}
                                value={value}
                                onInput={(e) => {
                                    props.eventEmitter.emit({
                                        type: "EditMyProfile",
                                        profile: {
                                            [key]: e.currentTarget.value,
                                        },
                                    });
                                    const lines = e.currentTarget.value.split("\n");
                                    e.currentTarget.setAttribute(
                                        "rows",
                                        `${lines.length}`,
                                    );
                                }}
                                type="text"
                                class={tw`${InputClass}`}
                            >
                            </textarea>
                        </Fragment>
                    );
                })
                : undefined}
            <div class={tw`${DividerClass}`}></div>
            <p class={tw`text-[${PrimaryTextColor}] font-blod text-[0.8125rem]`}>Custom Fields</p>
            <span class={tw`text-[${HintTextColor}] text-[0.875rem]`}>
                Create your own custom fields, anything goes!
            </span>
            <h3 class={tw`text-[${PrimaryTextColor}] mt-[1.5rem]`}>
                Field name
            </h3>
            <input
                placeholder="e.g. hobbies"
                value={props.newProfileField.key}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditNewProfileFieldKey",
                        key: e.currentTarget.value,
                    });
                }}
                type="text"
                class={tw`${InputClass}`}
            />
            <h3 class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                Field value
            </h3>
            <textarea
                placeholder="e.g. Sports, Reading, Design"
                rows={1}
                value={props.newProfileField.value}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "EditNewProfileFieldValue",
                        value: e.currentTarget.value,
                    });
                    const lines = e.currentTarget.value.split("\n");
                    e.currentTarget.setAttribute(
                        "rows",
                        `${lines.length}`,
                    );
                }}
                type="text"
                class={tw`${InputClass}`}
            >
            </textarea>
            <button
                class={tw`w-full mt-[1.5rem] p-[0.75rem] rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] bg-[${DividerBackgroundColor}] hover:bg-[${HoverButtonBackgroudColor}] ${CenterClass}`}
                onClick={() => {
                    props.eventEmitter.emit({
                        type: "InsertNewProfileField",
                    });
                }}
            >
                Add Field
            </button>
            <div class={tw`${DividerClass}`}></div>
            <div class={tw`mt-[1.5rem] flex justify-end`}>
                <button
                    class={tw`w-full p-[0.75rem] rounded-lg ${NoOutlineClass} text-[${PrimaryTextColor}] ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l`}
                    onClick={async () => {
                        if (props.myProfile) {
                            props.eventEmitter.emit({
                                type: "SaveMyProfile",
                                profile: props.myProfile,
                            });
                        }
                    }}
                >
                    Update Profile
                </button>
            </div>
        </div>
    );
}
