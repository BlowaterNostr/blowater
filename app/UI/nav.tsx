/** @jsx h */
import { ComponentChild, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { Avatar } from "./components/avatar.tsx";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import {
    PrimaryBackgroundColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
    SecondaryTextColor,
} from "./style/colors.ts";
import { ChatIcon } from "./icons/chat-icon.tsx";
import { UserIcon } from "./icons/user-icon.tsx";
import { SettingIcon } from "./icons/setting-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { ProfileGetter } from "./search.tsx";
import { ProfileData } from "../features/profile.ts";
import { AboutIcon } from "./icons/about-icon.tsx";

import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";
import { DownloadIcon } from "./icons/download-icon.tsx";
import { Profile_Nostr_Event } from "../nostr.ts";

export type InstallPrompt = {
    event: Event | undefined;
};

export type NavigationUpdate = {
    type: "ChangeNavigation";
    id: NavTabID;
};

export type NavigationModel = {
    activeNav: NavTabID;
};

type Props = {
    publicKey: PublicKey;
    profile: Profile_Nostr_Event | undefined;
    emit: emitFunc<NavigationUpdate>;
    isMobile?: boolean;
    installPrompt: InstallPrompt;
};

type State = {
    activeIndex: number;
    installPrompt: InstallPrompt;
};

type NavTabID = "DM" | "Profile" | "About" | "Setting";
type NavTab = {
    icon: (active: boolean) => ComponentChild;
    id: NavTabID;
};

export class NavBar extends Component<Props, State> {
    styles = {
        container:
            `h-screen w-16 flex flex-col gap-y-4 overflow-y-auto bg-[${PrimaryBackgroundColor}] py-8 items-center`,
        icons: (active: boolean, fill?: boolean) => (
            `w-6 h-6 ${fill ? "fill-current" : "stroke-current"} text-[${
                active ? PrimaryTextColor : SecondaryTextColor
            }]`
        ),
        avatar: `w-12 h-12`,
        tabsContainer:
            `last:flex-1 last:flex last:items-end last:flex last:flex-col last:justify-end last:gap-y-4`,
        tabs: (active: boolean) =>
            `rounded-lg w-10 h-10 ${
                active ? `bg-[${SecondaryBackgroundColor}]` : ""
            } hover:bg-[${SecondaryBackgroundColor}] ${CenterClass} ${NoOutlineClass}`,
        mobileContainer: `h-[4.5rem] flex justify-evenly bg-[${PrimaryBackgroundColor}] items-start pt-2`,
    };

    state: State = {
        activeIndex: 0,
        installPrompt: this.props.installPrompt,
    };
    tabs: NavTab[] = [
        {
            icon: (active: boolean) => <ChatIcon class={this.styles.icons(active)} />,
            id: "DM",
        },
        {
            icon: (active: boolean) => <UserIcon class={this.styles.icons(active)} />,
            id: "Profile",
        },
        {
            icon: (active: boolean) => <AboutIcon class={this.styles.icons(active, true)} />,
            id: "About",
        },
        {
            icon: (active: boolean) => <SettingIcon class={this.styles.icons(active)} />,
            id: "Setting",
        },
    ];

    changeTab = (activeIndex: number) => {
        if (activeIndex == this.state.activeIndex) {
            return;
        }

        this.props.emit({
            type: "ChangeNavigation",
            id: this.tabs[activeIndex].id,
        });

        this.setState({
            activeIndex: activeIndex,
        });
    };

    install = async () => {
        if (!this.props.installPrompt.event) {
            return;
        }

        // @ts-ignore
        const res = await this.props.installPrompt.event.prompt();
        if (res && res.outcome == "accepted") {
            this.setState({
                installPrompt: {
                    event: undefined,
                },
            });
        }
    };

    render() {
        return (
            this.props.isMobile
                ? (
                    <div class={this.styles.mobileContainer}>
                        {this.tabs.map((tab, index) => (
                            <Fragment>
                                {index == this.tabs.length - 1 && this.state.installPrompt.event
                                    ? (
                                        <button class={this.styles.tabs(false)} onClick={this.install}>
                                            <DownloadIcon class={this.styles.icons(false)} />
                                        </button>
                                    )
                                    : undefined}
                                <button
                                    onClick={() => this.changeTab(index)}
                                    class={this.styles.tabs(this.state.activeIndex == index)}
                                >
                                    {tab.icon(this.state.activeIndex == index)}
                                </button>
                            </Fragment>
                        ))}
                    </div>
                )
                : (
                    <div class={this.styles.container}>
                        <Avatar class={this.styles.avatar} picture={this.props.profile?.profile?.picture} />
                        {this.tabs.map((tab, index) => (
                            <div class={this.styles.tabsContainer}>
                                {index == this.tabs.length - 1 && this.state.installPrompt.event
                                    ? (
                                        <button class={this.styles.tabs(false)} onClick={this.install}>
                                            <DownloadIcon class={this.styles.icons(false)} />
                                        </button>
                                    )
                                    : undefined}

                                <button
                                    onClick={() => this.changeTab(index)}
                                    class={this.styles.tabs(this.state.activeIndex == index)}
                                >
                                    {tab.icon(this.state.activeIndex == index)}
                                </button>
                            </div>
                        ))}
                    </div>
                )
        );
    }
}
