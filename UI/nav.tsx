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
import { ChatIcon } from "./icons2/chat-icon.tsx";
import { UserIcon } from "./icons2/user-icon.tsx";
import { SettingIcon } from "./icons2/setting-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { ProfileGetter } from "./search.tsx";
import { ProfileData } from "../features/profile.ts";
import { AboutIcon } from "./icons2/about-icon.tsx";
import { AppListIcon } from "./icons2/app-list-icon.tsx";
import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";

export type NavigationUpdate = {
    type: "ChangeNavigation";
    id: NavTabID;
};

type Props = {
    publicKey: PublicKey;
    profileGetter: ProfileGetter;
    emit: emitFunc<NavigationUpdate>;
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
        tabs: (active: boolean) =>
            tw`rounded w-10 h-10 ${
                active ? `bg-[${SecondaryBackgroundColor}]` : ""
            } hover:bg-[${SecondaryBackgroundColor}] ${CenterClass} ${NoOutlineClass}`,
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
            <div class={this.styles.container}>
                <Avatar class={this.styles.avatar} picture={this.myProfile?.picture} />
                {this.tabs.map((tab, index) => (
                    <button
                        onClick={() => this.changeTab(index)}
                        class={this.styles.tabs(this.state.activeIndex == index)}
                    >
                        {tab.icon(this.state.activeIndex == index)}
                    </button>
                ))}
            </div>
        );
    }
}

// export type Props = {
//     profilePicURL: string | undefined;
//     publicKey: PublicKey;
//     database: db.Database_Contextual_View;
//     pool: ConnectionPool;
//     emit: emitFunc<NavigationUpdate>;
// } & NavigationModel;

// const navTabLayoutOrder: ActiveTab[] = ["DM", /*"Group",*/ "Profile", "About", "AppList"];
// const tabs = {
//     "DM": (active: boolean) => (
//         <ChatIcon
//             class={tw`stroke-current text-[${active ? PrimaryTextColor : SecondaryTextColor}]`}
//         />
//     ),
//     "Profile": (active: boolean) => (
//         <UserIcon
//         class={tw`stroke-current text-[${active ? PrimaryTextColor : SecondaryTextColor}]`}
//         />
//     ),
//     "About": (active: boolean) => (
//         <AboutIcon
//         class={tw`fill-current text-[${active ? PrimaryTextColor : SecondaryTextColor}]`}
//         />
//     ),
//     "AppList": (active: boolean) => (
//         <AppListIcon
//             class={tw`stroke-current text-[${active ? PrimaryTextColor : SecondaryTextColor}]`}
//         />
//     ),
// };

// export function NavBar(props: Props) {
//     return (
//         <div
//             class={tw`bg-[${PrimaryBackgroundColor}] w-[5.75rem] h-full flex flex-col justify-between overflow-y-auto px-[1.12rem] py-[3rem]`}
//         >
//             <div>
//                 <Avatar
//                     picture={props.profilePicURL}
//                     class={tw`w-[3.5rem] h-[3.5rem] m-auto mb-8`}
//                 />
//                 <ul>
//                     {navTabLayoutOrder.map((tab) => {
//                         const tabComponent = tabs[tab];
//                         return (
//                             <li
//                                 class={tw`
//                                     w-[3.5rem] h-[3.5rem] cursor-pointer hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] mb-[0.5rem] ${CenterClass}
//                                     ${
//                                     props.activeNav === tab
//                                         ? `bg-[${SecondaryBackgroundColor}] hover:bg-[${SecondaryBackgroundColor}]`
//                                         : ""
//                                 }
//                                 `}
//                                 onClick={() => {
//                                     props.emit({
//                                         type: "ChangeNavigation",
//                                         index: tab,
//                                     });
//                                 }}
//                             >
//                                 {tabComponent(props.activeNav === tab)}
//                             </li>
//                         );
//                     })}
//                 </ul>
//             </div>
//             <button
//                 onClick={() => {
//                     props.emit({
//                         type: "ChangeNavigation",
//                         index: "Setting",
//                     });
//                 }}
//                 class={tw`
//                         w-[3.5rem] h-[3.5rem] mx-auto hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] ${CenterClass} ${NoOutlineClass}
//                         ${props.activeNav === "Setting" ? `bg-[${SecondaryBackgroundColor}]` : ""}
//                         `}
//             >
//                 <SettingIcon
//                     class={tw`stroke-current text-[${props.activeNav === "Setting" ? PrimaryTextColor : SecondaryTextColor}]`}
//                 />
//             </button>
//         </div>
//     );
// }

// export function MobileNavBar(props: Props) {
//     return (
//         <div
//             class={tw`bg-[${PrimaryBackgroundColor}] h-16 w-full flex p-4 justify-evenly`}
//         >
//             <div
//                 class={tw`flex`}
//                 style={{
//                     minWidth: "fit-content",
//                 }}
//             >
//                 <ul class={tw`flex`}>
//                     {navTabLayoutOrder.map((tab) => {
//                         const tabComponent = tabs[tab];
//                         return (
//                             <li
//                                 class={tw`
//                                 w-[3.5rem] h-[3.5rem] cursor-pointer hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] mr-[0.5rem] ${CenterClass}
//                                 ${
//                                     props.activeNav === tab
//                                         ? `bg-[${SecondaryBackgroundColor}] hover:bg-[${SecondaryBackgroundColor}]`
//                                         : ""
//                                 }
//                             `}
//                                 onClick={() => {
//                                     props.emit({
//                                         type: "ChangeNavigation",
//                                         index: tab,
//                                     });
//                                 }}
//                             >
//                                 {tabComponent(props.activeNav === tab)}
//                             </li>
//                         );
//                     })}
//                 </ul>
//             </div>
//             <div
//                 class={tw`w-20 h-full flex`}
//                 style={{
//                     minWidth: "5rem",
//                 }}
//             >
//                 <button
//                     onClick={() => {
//                         props.emit({
//                             type: "ChangeNavigation",
//                             index: "Setting",
//                         });
//                     }}
//                     class={tw`
//                             w-[3.5rem] h-[3.5rem] mx-auto hover:bg-[${SecondaryBackgroundColor}] rounded-[1rem] ${CenterClass} ${NoOutlineClass}
//                             ${props.activeNav === "Setting" ? `bg-[${SecondaryBackgroundColor}]` : ""}
//                             `}
//                 >
//                     <SettingIcon
//                         class={tw`w-8 h-8`}
//                         style={{
//                             stroke: props.activeNav === "Setting" ? PrimaryTextColor : SecondaryTextColor,
//                             fill: "none",
//                         }}
//                     />
//                 </button>
//             </div>
//         </div>
//     );
// }
