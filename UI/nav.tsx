/** @jsx h */
import { ComponentChild, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Avatar } from "./components/avatar.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
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
import { AppListIcon } from "./icons/app-list-icon.tsx";
import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";

export type NavigationUpdate = {
    type: "ChangeNavigation";
    id: NavTabID;
};

export type NavigationModel = {
    activeNav: NavTabID;
};

type Props = {
    publicKey: PublicKey;
    profileGetter: ProfileGetter;
    emit: emitFunc<NavigationUpdate>;
    isMobile?: boolean;
};

type State = {
    activeIndex: number;
};

type NavTabID = "DM" | "Profile" | "About" | "AppList" | "Setting";
type NavTab = {
    icon: (active: boolean) => ComponentChild;
    id: NavTabID;
};

export class NavBar extends Component<Props, State> {
    styles = {
        container:
            tw`h-full w-16 flex flex-col gap-y-4 overflow-y-auto bg-[${PrimaryBackgroundColor}] py-8 items-center`,
        icons: (active: boolean, fill?: boolean) => (
            tw`w-6 h-6 ${fill ? "fill-current" : "stroke-current"} text-[${
                active ? PrimaryTextColor : SecondaryTextColor
            }]`
        ),
        avatar: tw`w-12 h-12`,
        tabsContainer: tw`last:flex-1 last:flex last:items-end`,
        tabs: (active: boolean) =>
            tw`rounded-lg w-10 h-10 ${
                active ? `bg-[${SecondaryBackgroundColor}]` : ""
            } hover:bg-[${SecondaryBackgroundColor}] ${CenterClass} ${NoOutlineClass}`,
        mobileContainer: tw`h-[4.5rem] flex justify-evenly bg-[${PrimaryBackgroundColor}] items-start pt-2`,
    };

    myProfile: ProfileData | undefined;
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
            icon: (active: boolean) => <AppListIcon class={this.styles.icons(active, true)} />,
            id: "AppList",
        },
        {
            icon: (active: boolean) => <SettingIcon class={this.styles.icons(active)} />,
            id: "Setting",
        },
    ];

    componentWillMount() {
        this.setState({
            activeIndex: 0,
        });
        this.myProfile = this.props.profileGetter.getProfilesByPublicKey(this.props.publicKey)?.profile;
    }

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

    render() {
        return (
            this.props.isMobile
                ? (
                    <div class={this.styles.mobileContainer}>
                        {this.tabs.map((tab, index) => (
                            <button
                                onClick={() => this.changeTab(index)}
                                class={this.styles.tabs(this.state.activeIndex == index)}
                            >
                                {tab.icon(this.state.activeIndex == index)}
                            </button>
                        ))}
                    </div>
                )
                : (
                    <div class={this.styles.container}>
                        <Avatar class={this.styles.avatar} picture={this.myProfile?.picture} />
                        {this.tabs.map((tab, index) => (
                            <div class={this.styles.tabsContainer}>
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
