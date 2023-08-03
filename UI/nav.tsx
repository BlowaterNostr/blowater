/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { AboutIcon, AppListIcon } from "./icons/mod.tsx";
import * as db from "../database.ts";

import { Avatar } from "./components/avatar.tsx";
import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import { EventEmitter } from "../event-bus.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import {
    PrimaryBackgroundColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
    SecondaryTextColor,
} from "./style/colors.ts";
import { ChatIcon } from "./icons2/chat-icon.tsx";
import { UserIcon } from "./icons2/user-icon.tsx";
import { SocialIcon } from "./icons2/social-icon.tsx";
import { SettingIcon } from "./icons2/setting-icon.tsx";

export type Props = {
    profilePicURL: string | undefined;
    publicKey: PublicKey;
    database: db.Database_Contextual_View;
    pool: ConnectionPool;
    AddRelayButtonClickedError: string;
    AddRelayInput: string;
    eventEmitter: EventEmitter<NavigationUpdate>;
} & NavigationModel;

export type ActiveNav = ActiveTab | "Setting";
export type ActiveTab = "DM" | /* "Group" | */ "Profile" | "About" | "Social" | "AppList";

export type NavigationModel = {
    activeNav: ActiveNav;
};

export type NavigationUpdate = {
    type: "ChangeNavigation";
    index: ActiveNav;
};

const navTabLayoutOrder: ActiveTab[] = ["DM", /*"Group",*/ "Profile", "About", "Social", "AppList"];
const tabs = {
    "DM": (active: boolean) => (
        <ChatIcon
            class={tw`w-[2rem] h-[2rem]`}
            style={{
                stroke: active ? PrimaryTextColor : SecondaryTextColor,
                fill: "none",
            }}
        />
    ),
    "Profile": (active: boolean) => (
        <UserIcon
            class={tw`w-[2rem] h-[2rem]`}
            style={{
                stroke: active ? PrimaryTextColor : SecondaryTextColor,
                fill: "none",
            }}
        />
    ),
    "About": (active: boolean) => (
        <AboutIcon
            class={tw`w-[2rem] h-[2rem]`}
            style={{
                fill: active ? PrimaryTextColor : SecondaryTextColor,
            }}
        />
    ),
    "Social": (active: boolean) => (
        <SocialIcon
            class={tw`w-[2rem] h-[2rem]`}
            style={{
                stroke: active ? PrimaryTextColor : SecondaryTextColor,
                fill: "none",
            }}
        />
    ),
    "AppList": (active: boolean) => (
        <AppListIcon
            class={tw`w-[2rem] h-[2rem]`}
            style={{
                stroke: active ? PrimaryTextColor : SecondaryTextColor,
                fill: "none",
            }}
        />
    ),
};

export function NavBar(props: Props) {
    return (
        <div
            class={tw`bg-[${PrimaryBackgroundColor}] w-[5.75rem] h-full flex flex-col justify-between overflow-y-auto px-[1.12rem] py-[3rem]`}
        >
            <div>
                <Avatar
                    picture={props.profilePicURL}
                    class={tw`w-[3.5rem] h-[3.5rem] m-auto mb-[2rem]`}
                />
                <ul>
                    {navTabLayoutOrder.map((tab) => {
                        const tabComponent = tabs[tab];
                        return (
                            <li
                                class={tw`
                                    w-[3.5rem] h-[3.5rem] cursor-pointer hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] mb-[0.5rem] ${CenterClass}
                                    ${
                                    props.activeNav === tab
                                        ? `bg-[${SecondaryBackgroundColor}] hover:bg-[${SecondaryBackgroundColor}]`
                                        : ""
                                }
                                `}
                                onClick={() => {
                                    props.eventEmitter.emit({
                                        type: "ChangeNavigation",
                                        index: tab,
                                    });
                                }}
                            >
                                {tabComponent(props.activeNav === tab)}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <button
                onClick={() => {
                    props.eventEmitter.emit({
                        type: "ChangeNavigation",
                        index: "Setting",
                    });
                }}
                class={tw`
                        w-[3.5rem] h-[3.5rem] mx-auto hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] ${CenterClass} ${NoOutlineClass}
                        ${props.activeNav === "Setting" ? `bg-[${SecondaryBackgroundColor}]` : ""}
                        `}
            >
                <SettingIcon
                    class={tw`w-[2rem] h-[2rem]`}
                    style={{
                        stroke: props.activeNav === "Setting" ? PrimaryTextColor : SecondaryTextColor,
                        fill: "none",
                    }}
                />
            </button>
        </div>
    );
}

export function MobileNavBar(props: Props) {
    return (
        <div
            class={tw`bg-[${PrimaryBackgroundColor}] h-[5.75rem] w-full flex justify-between overflow-x-auto py-[1.12rem] px-[3rem]`}
        >
            <div
                class={tw`flex`}
                style={{
                    minWidth: "fit-content",
                }}
            >
                <ul class={tw`flex`}>
                    {navTabLayoutOrder.map((tab) => {
                        const tabComponent = tabs[tab];
                        return (
                            <li
                                class={tw`
                                w-[3.5rem] h-[3.5rem] cursor-pointer hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] mr-[0.5rem] ${CenterClass}
                                ${
                                    props.activeNav === tab
                                        ? `bg-[${SecondaryBackgroundColor}] hover:bg-[${SecondaryBackgroundColor}]`
                                        : ""
                                }
                            `}
                                onClick={() => {
                                    props.eventEmitter.emit({
                                        type: "ChangeNavigation",
                                        index: tab,
                                    });
                                }}
                            >
                                {tabComponent(props.activeNav === tab)}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div
                class={tw`w-20 h-full flex`}
                style={{
                    minWidth: "5rem",
                }}
            >
                <button
                    onClick={() => {
                        props.eventEmitter.emit({
                            type: "ChangeNavigation",
                            index: "Setting",
                        });
                    }}
                    class={tw`
                            w-[3.5rem] h-[3.5rem] mx-auto hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] ${CenterClass} ${NoOutlineClass}
                            ${props.activeNav === "Setting" ? `bg-[${SecondaryBackgroundColor}]` : ""}
                            `}
                >
                    <SettingIcon
                        class={tw`w-[2rem] h-[2rem]`}
                        style={{
                            stroke: props.activeNav === "Setting" ? PrimaryTextColor : SecondaryTextColor,
                            fill: "none",
                        }}
                    />
                </button>
            </div>
        </div>
    );
}
