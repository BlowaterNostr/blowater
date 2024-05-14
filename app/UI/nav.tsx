/** @jsx h */
import { ComponentChild, h } from "https://esm.sh/preact@10.17.1";
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
import { AboutIcon } from "./icons/about-icon.tsx";

import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";
import { DownloadIcon } from "./icons/download-icon.tsx";
import { Profile_Nostr_Event } from "../nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { RelaySwitchList } from "./relay-switch-list.tsx";
import { SocialIcon } from "./icons/social-icon.tsx";
import { SearchIcon } from "./icons/search-icon.tsx";
import { StartSearch } from "./search_model.ts";

export type InstallPrompt = {
    event: Event | undefined;
};

export type NavigationUpdate = {
    type: "ChangeNavigation";
    id: NavTabID;
};

export type SelectRelay = {
    type: "SelectRelay";
    relay: SingleRelayConnection;
};

export type NavigationModel = {
    activeNav: NavTabID;
};

type Props = {
    publicKey: PublicKey;
    profile: Profile_Nostr_Event | undefined;
    emit: emitFunc<NavigationUpdate | SelectRelay | StartSearch>;
    installPrompt: InstallPrompt;
    pool: ConnectionPool;
    activeNav: NavTabID;
    currentRelay: string;
};

type State = {
    installPrompt: InstallPrompt;
};

type NavTabID = "Public" | "DM" | "Search" | "Profile" | "About" | "Setting";
type NavTab = {
    icon: (active: boolean) => ComponentChild;
    id: NavTabID;
};

export class NavBar extends Component<Props, State> {
    styles = {
        container:
            `h-screen w-16 flex flex-col gap-y-4 overflow-y-auto bg-[${PrimaryBackgroundColor}] py-8 items-center`,
        icons: (active: boolean) => (
            `w-6 h-6 stroke-current text-[${active ? PrimaryTextColor : SecondaryTextColor}]`
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
        installPrompt: this.props.installPrompt,
    };

    tabs: NavTab[] = [
        {
            icon: (active: boolean) => <SocialIcon class={this.styles.icons(active)} />,
            id: "Public",
        },
        {
            icon: (active: boolean) => <ChatIcon class={this.styles.icons(active)} />,
            id: "DM",
        },
        {
            icon: (active: boolean) => <SearchIcon class={this.styles.icons(active)} />,
            id: "Search",
        },
        {
            icon: (active: boolean) => <UserIcon class={this.styles.icons(active)} />,
            id: "Profile",
        },
        {
            icon: (active: boolean) => <AboutIcon class={this.styles.icons(active)} />,
            id: "About",
        },
        {
            icon: (active: boolean) => <SettingIcon class={this.styles.icons(active)} />,
            id: "Setting",
        },
    ];

    changeTab = async (activeNav: NavTabID) => {
        if (activeNav == this.props.activeNav) {
            return;
        }
        this.props.emit({
            type: "ChangeNavigation",
            id: activeNav,
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

    render(props: Props) {
        return (
            <div class={this.styles.container}>
                {/* <Avatar class={this.styles.avatar} picture={this.props.profile?.profile?.picture} /> */}
                {
                    <RelaySwitchList
                        emit={props.emit}
                        pool={props.pool}
                        currentRelay={props.currentRelay}
                    />
                }
                {this.tabs.map(({ icon, id }) => (
                    <div class={this.styles.tabsContainer}>
                        {id === "Setting" && this.state.installPrompt.event
                            ? (
                                <button class={this.styles.tabs(false)} onClick={this.install}>
                                    <DownloadIcon class={this.styles.icons(false)} />
                                </button>
                            )
                            : undefined}

                        <button
                            onClick={() => {
                                if (id === "Search") {
                                    props.emit({
                                        type: "StartSearch",
                                    });
                                } else {
                                    this.changeTab(id);
                                }
                            }}
                            class={this.styles.tabs(this.props.activeNav === id)}
                        >
                            {icon(this.props.activeNav === id)}
                        </button>
                    </div>
                ))}
            </div>
        );
    }
}
