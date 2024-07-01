/** @jsx h */
import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { CopyButton } from "./components/copy-button.tsx";
import { CenterClass, InputClass } from "./components/tw.ts";
import {
    BackgroundColor_HoverButton,
    ErrorColor,
    HintTextColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";
import { Avatar } from "./components/avatar.tsx";
import { func_GetProfileByPublicKey } from "./search.tsx";
import { Loading } from "./components/loading.tsx";
import { Profile_Nostr_Event } from "../nostr.ts";
import { emitFunc } from "../event-bus.ts";
import { SelectConversation } from "./search_model.ts";
import { PublicKey, RelayInformation, robohash } from "@blowater/nostr-sdk";
import { setState } from "./_helper.ts";
import { Channel } from "@blowater/csp";
import { ViewUserDetail } from "./message-panel.tsx";

type SpaceSettingProps = {
    spaceUrl: URL;
    emit: emitFunc<SelectConversation | ViewUserDetail>;
    getProfileByPublicKey: func_GetProfileByPublicKey;
    getSpaceInformationChan: func_GetSpaceInformationChan;
    getMemberSet: func_GetMemberSet;
};

type SpaceSettingState = {
    tab: tabs;
    info: RelayInformation | undefined;
};

type tabs = "general" | "members";

// return a set of public keys that participates in this relay
export type func_GetMemberSet = (space_url: URL) => Set<string>;
export type func_GetSpaceInformationChan = () => Channel<RelayInformation | Error>;

export class SpaceSetting extends Component<SpaceSettingProps, SpaceSettingState> {
    infoStream: Channel<RelayInformation | Error> | undefined;
    state: SpaceSettingState = {
        tab: "general",
        info: undefined,
    };

    async componentDidMount() {
        this.infoStream = this.props.getSpaceInformationChan();
        for await (const info of this.infoStream) {
            if (info instanceof Error) {
                console.error(info.message, info.cause);
            } else {
                await setState(this, { info });
            }
        }
    }

    async componentWillUnmount() {
        await this.infoStream?.close();
    }

    render() {
        return (
            <div class="mx-6 mt-6 text-[#FFFFFF] h-full">
                <div class="text-[1.8rem]">Space Settings</div>
                <div class="flex flex-row h-full">
                    <div class="flex flex-col">
                        <div
                            class="flex flex-row p-2 hover:bg-[#737373] hover:rounded-lg mt-2 hover:cursor-pointer"
                            onClick={this.changeTab("general")}
                        >
                            <svg
                                class="w-6 h-6 mr-3"
                                viewBox="0 0 14 14"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M7.00003 4.00003C6.40668 4.00003 5.82667 4.17598 5.33332 4.50562C4.83997 4.83526 4.45545 5.3038 4.22839 5.85198C4.00133 6.40016 3.94192 7.00336 4.05767 7.5853C4.17343 8.16724 4.45915 8.70179 4.87871 9.12135C5.29827 9.54091 5.83281 9.82663 6.41476 9.94238C6.9967 10.0581 7.5999 9.99873 8.14808 9.77167C8.69626 9.5446 9.16479 9.16009 9.49444 8.66674C9.82408 8.17339 10 7.59337 10 7.00003C9.9992 6.20463 9.68287 5.44205 9.12044 4.87962C8.55801 4.31719 7.79542 4.00086 7.00003 4.00003ZM7.00003 9.00003C6.60447 9.00003 6.21779 8.88273 5.88889 8.66297C5.55999 8.4432 5.30364 8.13085 5.15227 7.7654C5.00089 7.39994 4.96129 6.99781 5.03846 6.60985C5.11563 6.22189 5.30611 5.86552 5.58581 5.58581C5.86552 5.30611 6.22189 5.11563 6.60985 5.03846C6.99781 4.96129 7.39994 5.00089 7.7654 5.15227C8.13085 5.30364 8.4432 5.55999 8.66297 5.88889C8.88273 6.21779 9.00003 6.60447 9.00003 7.00003C9.00003 7.53046 8.78931 8.03917 8.41424 8.41424C8.03917 8.78931 7.53046 9.00003 7.00003 9.00003ZM12.5 7.13503C12.5025 7.04503 12.5025 6.95503 12.5 6.86503L13.4325 5.70003C13.4814 5.63886 13.5153 5.56706 13.5313 5.49042C13.5474 5.41378 13.5452 5.33443 13.525 5.25878C13.3722 4.68415 13.1435 4.13243 12.845 3.61815C12.806 3.55085 12.7517 3.4936 12.6866 3.45096C12.6215 3.40832 12.5473 3.38146 12.47 3.37253L10.9875 3.20753C10.9259 3.14253 10.8634 3.08003 10.8 3.02003L10.625 1.53378C10.616 1.45641 10.5891 1.38222 10.5463 1.31711C10.5036 1.252 10.4462 1.19779 10.3788 1.15878C9.8643 0.86087 9.31263 0.632425 8.73815 0.479404C8.66245 0.459277 8.58308 0.457218 8.50643 0.473394C8.42979 0.489569 8.35802 0.523527 8.2969 0.572529L7.13503 1.50003C7.04503 1.50003 6.95503 1.50003 6.86503 1.50003L5.70003 0.569404C5.63886 0.520509 5.56706 0.486665 5.49042 0.470598C5.41378 0.454531 5.33443 0.456691 5.25878 0.476903C4.68425 0.630045 4.13256 0.858705 3.61815 1.1569C3.55085 1.19598 3.4936 1.25023 3.45096 1.31533C3.40832 1.38044 3.38146 1.45459 3.37253 1.5319L3.20753 3.0169C3.14253 3.07899 3.08003 3.14149 3.02003 3.2044L1.53378 3.37503C1.45641 3.38403 1.38222 3.41098 1.31711 3.45373C1.252 3.49649 1.19779 3.55386 1.15878 3.62128C0.86087 4.13576 0.632425 4.68743 0.479404 5.2619C0.459277 5.33761 0.457218 5.41698 0.473394 5.49362C0.489569 5.57027 0.523527 5.64204 0.572529 5.70315L1.50003 6.86503C1.50003 6.95503 1.50003 7.04503 1.50003 7.13503L0.569404 8.30003C0.520509 8.3612 0.486665 8.43299 0.470598 8.50964C0.454531 8.58628 0.456691 8.66562 0.476903 8.74128C0.629772 9.3159 0.858447 9.86762 1.1569 10.3819C1.19598 10.4492 1.25023 10.5065 1.31533 10.5491C1.38044 10.5917 1.45459 10.6186 1.5319 10.6275L3.0144 10.7925C3.07649 10.8575 3.13899 10.92 3.2019 10.98L3.37503 12.4663C3.38403 12.5436 3.41098 12.6178 3.45373 12.6829C3.49649 12.7481 3.55386 12.8023 3.62128 12.8413C4.13576 13.1392 4.68743 13.3676 5.2619 13.5207C5.33761 13.5408 5.41698 13.5428 5.49362 13.5267C5.57027 13.5105 5.64204 13.4765 5.70315 13.4275L6.86503 12.5C6.95503 12.5025 7.04503 12.5025 7.13503 12.5L8.30003 13.4325C8.3612 13.4814 8.43299 13.5153 8.50964 13.5313C8.58628 13.5474 8.66562 13.5452 8.74128 13.525C9.3159 13.3722 9.86762 13.1435 10.3819 12.845C10.4492 12.806 10.5065 12.7517 10.5491 12.6866C10.5917 12.6215 10.6186 12.5473 10.6275 12.47L10.7925 10.9875C10.8575 10.9259 10.92 10.8634 10.98 10.8L12.4663 10.625C12.5436 10.616 12.6178 10.5891 12.6829 10.5463C12.7481 10.5036 12.8023 10.4462 12.8413 10.3788C13.1392 9.8643 13.3676 9.31263 13.5207 8.73815C13.5408 8.66245 13.5428 8.58308 13.5267 8.50643C13.5105 8.42979 13.4765 8.35802 13.4275 8.2969L12.5 7.13503ZM11.4938 6.72878C11.5044 6.90946 11.5044 7.0906 11.4938 7.27128C11.4863 7.39498 11.5251 7.51703 11.6025 7.61378L12.4894 8.7219C12.3876 9.04532 12.2573 9.35905 12.1 9.6594L10.6875 9.8194C10.5645 9.83306 10.4509 9.89185 10.3688 9.9844C10.2485 10.1197 10.1203 10.2478 9.98503 10.3682C9.89247 10.4503 9.83368 10.5639 9.82003 10.6869L9.66315 12.0982C9.36284 12.2555 9.0491 12.3858 8.72565 12.4875L7.6169 11.6007C7.52818 11.5298 7.41797 11.4912 7.3044 11.4913H7.2744C7.09373 11.5019 6.91258 11.5019 6.7319 11.4913C6.60821 11.4838 6.48615 11.5226 6.3894 11.6L5.27815 12.4875C4.95474 12.3858 4.641 12.2555 4.34065 12.0982L4.18065 10.6875C4.167 10.5645 4.10821 10.4509 4.01565 10.3688C3.88035 10.2485 3.75221 10.1203 3.6319 9.98503C3.54974 9.89247 3.43616 9.83368 3.31315 9.82003L1.9019 9.66253C1.74452 9.36222 1.61422 9.04847 1.51253 8.72503L2.3994 7.61628C2.47684 7.51953 2.5156 7.39748 2.50815 7.27378C2.49753 7.0931 2.49753 6.91196 2.50815 6.73128C2.5156 6.60758 2.47684 6.48552 2.3994 6.38878L1.51253 5.27815C1.61429 4.95474 1.7446 4.641 1.9019 4.34065L3.31253 4.18065C3.43554 4.167 3.54911 4.10821 3.63128 4.01565C3.75159 3.88035 3.87972 3.75221 4.01503 3.6319C4.10795 3.54968 4.16698 3.43585 4.18065 3.31253L4.33753 1.9019C4.63784 1.74452 4.95158 1.61422 5.27503 1.51253L6.38378 2.3994C6.48052 2.47684 6.60258 2.5156 6.72628 2.50815C6.90696 2.49753 7.0881 2.49753 7.26878 2.50815C7.39248 2.5156 7.51453 2.47684 7.61128 2.3994L8.7219 1.51253C9.04532 1.61429 9.35905 1.7446 9.6594 1.9019L9.8194 3.31253C9.83306 3.43554 9.89185 3.54911 9.9844 3.63128C10.1197 3.75159 10.2478 3.87972 10.3682 4.01503C10.4503 4.10758 10.5639 4.16637 10.6869 4.18003L12.0982 4.3369C12.2555 4.63722 12.3858 4.95096 12.4875 5.2744L11.6007 6.38315C11.5225 6.48071 11.4837 6.60403 11.4919 6.72878H11.4938Z"
                                    fill="#D4D4D4"
                                />
                            </svg>
                            <div>General</div>
                        </div>
                        <div
                            class="flex flex-row p-2 hover:bg-[#737373] hover:rounded-lg mt-2 hover:cursor-pointer"
                            onClick={this.changeTab("members")}
                        >
                            <svg
                                class="w-6 h-6 mr-3"
                                width="16"
                                height="10"
                                viewBox="0 0 16 10"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path
                                    d="M7.32791 6.87006C7.99804 6.42393 8.50681 5.77398 8.77898 5.01634C9.05115 4.2587 9.07227 3.43358 8.83923 2.663C8.60619 1.89242 8.13135 1.21729 7.48493 0.737449C6.83851 0.25761 6.05483 -0.00146484 5.24979 -0.00146484C4.44474 -0.00146484 3.66106 0.25761 3.01464 0.737449C2.36823 1.21729 1.89339 1.89242 1.66034 2.663C1.4273 3.43358 1.44843 4.2587 1.7206 5.01634C1.99277 5.77398 2.50154 6.42393 3.17166 6.87006C1.95947 7.31683 0.924228 8.14358 0.220412 9.22693C0.183422 9.28191 0.157728 9.34369 0.144825 9.40869C0.131922 9.47368 0.132066 9.54059 0.14525 9.60553C0.158434 9.67047 0.184394 9.73214 0.221621 9.78695C0.258848 9.84177 0.3066 9.88864 0.362101 9.92484C0.417602 9.96104 0.479745 9.98585 0.544917 9.99782C0.610089 10.0098 0.676991 10.0087 0.741734 9.99458C0.806477 9.98047 0.867769 9.95363 0.922048 9.91562C0.976327 9.87761 1.02251 9.8292 1.05791 9.77318C1.51191 9.07492 2.13313 8.50113 2.86519 8.10392C3.59724 7.70671 4.41691 7.49865 5.24979 7.49865C6.08266 7.49865 6.90234 7.70671 7.63439 8.10392C8.36644 8.50113 8.98767 9.07492 9.44166 9.77318C9.515 9.88218 9.62828 9.95793 9.75702 9.98407C9.88577 10.0102 10.0196 9.98463 10.1297 9.91286C10.2397 9.84109 10.3171 9.7289 10.345 9.60055C10.373 9.47219 10.3493 9.33798 10.2792 9.22693C9.57535 8.14358 8.5401 7.31683 7.32791 6.87006ZM2.49979 3.75006C2.49979 3.20616 2.66107 2.67447 2.96325 2.22224C3.26542 1.77 3.69491 1.41753 4.19741 1.20939C4.6999 1.00125 5.25284 0.946788 5.78629 1.0529C6.31973 1.15901 6.80974 1.42092 7.19433 1.80551C7.57893 2.19011 7.84084 2.68011 7.94695 3.21356C8.05306 3.74701 7.9986 4.29994 7.79046 4.80244C7.58231 5.30493 7.22984 5.73442 6.77761 6.0366C6.32537 6.33877 5.79369 6.50006 5.24979 6.50006C4.5207 6.49923 3.8217 6.20923 3.30616 5.69369C2.79061 5.17814 2.50061 4.47915 2.49979 3.75006ZM15.6335 9.91881C15.5225 9.99123 15.3872 10.0166 15.2574 9.98927C15.1277 9.96196 15.0141 9.88423 14.9417 9.77318C14.4882 9.07451 13.8671 8.50047 13.1349 8.10342C12.4027 7.70637 11.5827 7.49894 10.7498 7.50006C10.6172 7.50006 10.49 7.44738 10.3962 7.35361C10.3025 7.25984 10.2498 7.13267 10.2498 7.00006C10.2498 6.86745 10.3025 6.74027 10.3962 6.6465C10.49 6.55274 10.6172 6.50006 10.7498 6.50006C11.1548 6.49968 11.5547 6.40985 11.9209 6.237C12.2872 6.06416 12.6107 5.81255 12.8684 5.50017C13.1262 5.18778 13.3117 4.82233 13.4118 4.42992C13.512 4.03751 13.5242 3.62783 13.4476 3.23015C13.371 2.83247 13.2076 2.45661 12.9689 2.12943C12.7303 1.80225 12.4223 1.53181 12.067 1.33745C11.7117 1.14309 11.3178 1.02961 10.9136 1.0051C10.5094 0.980591 10.1047 1.04567 9.72854 1.19568C9.6672 1.2222 9.60118 1.23615 9.53436 1.23671C9.46754 1.23728 9.40129 1.22444 9.33952 1.19897C9.27775 1.1735 9.22171 1.1359 9.17471 1.0884C9.12771 1.0409 9.09071 0.984465 9.0659 0.922425C9.04108 0.860385 9.02895 0.794 9.03023 0.727193C9.0315 0.660386 9.04615 0.594513 9.07332 0.533464C9.10048 0.472416 9.13961 0.417431 9.18838 0.37176C9.23715 0.326088 9.29459 0.290656 9.35729 0.267557C10.2182 -0.0757864 11.1758 -0.0881419 12.0452 0.232873C12.9147 0.553889 13.6345 1.18553 14.0658 2.00594C14.497 2.82635 14.6092 3.77741 14.3806 4.67563C14.152 5.57385 13.5989 6.3556 12.8279 6.87006C14.0401 7.31683 15.0753 8.14358 15.7792 9.22693C15.8516 9.338 15.8769 9.47328 15.8496 9.60303C15.8223 9.73277 15.7446 9.84636 15.6335 9.91881Z"
                                    fill="white"
                                />
                            </svg>

                            <div class="">Members</div>
                        </div>
                    </div>
                    <div class="mx-8"></div>
                    <div class="h-full overflow-scroll">
                        {this.state.tab == "general"
                            ? this.state.info == undefined ? <Loading /> : (
                                <RelayInformationComponent
                                    {...this.props}
                                    info={{
                                        ...this.state.info,
                                        url: this.props.spaceUrl.toString(),
                                    }}
                                />
                            )
                            : (
                                <MemberList
                                    getProfileByPublicKey={this.props.getProfileByPublicKey}
                                    emit={this.props.emit}
                                    getMemberSet={this.props.getMemberSet}
                                    space_url={this.props.spaceUrl}
                                />
                            )}
                    </div>
                </div>
            </div>
        );
    }

    changeTab = (tab: tabs) => () => {
        this.setState({
            tab,
        });
    };
}

type State = {
    error: string;
};

type Props = {
    getProfileByPublicKey: func_GetProfileByPublicKey;
    emit: emitFunc<SelectConversation>;
    info: RelayInformation & { url: string };
};

export class RelayInformationComponent extends Component<Props, State> {
    styles = {
        container: `bg-[${SecondaryBackgroundColor}] p-8`,
        title: `pt-8 text-[${PrimaryTextColor}]`,
        error: `text-[${ErrorColor}] ${CenterClass}`,
        header: {
            container: `text-lg flex text-[${PrimaryTextColor}] pb-4`,
        },
    };

    state: State = {
        error: "",
    };

    render() {
        const info = this.props.info;
        let vNode;
        if (this.state.error) {
            vNode = <p class={this.styles.error}>{this.state.error}</p>;
        } else {
            const nodes = [];
            if (info.pubkey) {
                const pubkey = PublicKey.FromString(info.pubkey);
                if (pubkey instanceof Error) {
                    // todo make a UI
                    console.log(info);
                    console.error(pubkey);
                } else {
                    nodes.push(
                        <Fragment>
                            <p class={this.styles.title}>Admin</p>
                            <AuthorField
                                publicKey={pubkey}
                                profileData={this.props.getProfileByPublicKey(pubkey)}
                                emit={this.props.emit}
                            />
                        </Fragment>,
                    );
                }
            }
            if (info.contact) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Contact</p>
                        <TextField text={info.contact} />
                    </Fragment>,
                );
            }
            if (info.description) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Description</p>
                        <TextField text={info.description} />
                    </Fragment>,
                );
            }
            if (info.software) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Software</p>
                        <TextField text={info.software} />
                    </Fragment>,
                );
            }
            if (info.version) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Version</p>
                        <TextField text={info.version} />
                    </Fragment>,
                );
            }
            if (info.supported_nips) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Supported NIPs</p>
                        <TextField text={info.supported_nips.join(", ")} />
                    </Fragment>,
                );
            }
            vNode = (
                <div>
                    {nodes}
                </div>
            );
        }

        return (
            <div class={this.styles.container}>
                <p class={this.styles.header.container}>
                    {info.icon
                        ? (
                            <Avatar
                                class="w-8 h-8 mr-2"
                                picture={info.icon || robohash(this.props.info.url)}
                            />
                        )
                        : undefined}
                    {info.name}
                    <div class="mx-2"></div>
                    {this.props.info.url}
                </p>
                {vNode}
            </div>
        );
    }
}

type MemberListProps = {
    getProfileByPublicKey: func_GetProfileByPublicKey;
    emit: emitFunc<SelectConversation | ViewUserDetail>;
    getMemberSet: func_GetMemberSet;
    space_url: URL;
};

export class MemberList extends Component<MemberListProps> {
    clickSpaceMember = (pubkey: string) => () => {
        const p = PublicKey.FromString(pubkey);
        if (p instanceof Error) {
            return console.error(p);
        }
        this.props.emit({
            type: "ViewUserDetail",
            pubkey: p,
        });
    };

    render(props: MemberListProps) {
        const members = props.getMemberSet(props.space_url);
        return (
            <>
                {Array.from(members).map((member) => {
                    const profile = props.getProfileByPublicKey(member);
                    return (
                        <div
                            class="w-full flex items-center px-4 py-2 text-[#B8B9BF] hover:bg-[#404249] rounded-lg cursor-pointer"
                            onClick={this.clickSpaceMember(member)}
                        >
                            <Avatar
                                class={`flex-shrink-0 w-8 h-8 mr-2 bg-neutral-600 rounded-full`}
                                picture={profile?.profile.picture || robohash(member)}
                            >
                            </Avatar>
                            <div class="truncate">
                                {profile?.profile.name || profile?.profile.display_name ||
                                    member}
                            </div>
                        </div>
                    );
                })}
            </>
        );
    }
}

function AuthorField(props: {
    publicKey: PublicKey;
    profileData: Profile_Nostr_Event | undefined;
    emit: emitFunc<SelectConversation>;
}) {
    const styles = {
        avatar: `h-8 w-8 mr-2`,
        icon: `w-4 h-4 text-[${HintTextColor}] fill-current rotate-180`,
        name: `overflow-x-auto flex-1`,
    };

    const { profileData, publicKey } = props;
    return (
        <Fragment>
            <div
                class={`flex items-center ${InputClass} mt-4 hover:${BackgroundColor_HoverButton} hover:cursor-pointer`}
                onClick={() => props.emit({ type: "SelectConversation", pubkey: props.publicKey })}
            >
                <Avatar
                    picture={profileData?.profile.picture || robohash(publicKey.bech32())}
                    class={styles.avatar}
                />
                <p class={styles.name}>{profileData?.profile.name || publicKey.bech32()}</p>
            </div>

            <TextField text={publicKey.bech32()} />
        </Fragment>
    );
}

function TextField(props: {
    text: string;
}) {
    const styles = {
        container: `relative ${InputClass} resize-none flex p-0 mt-4`,
        pre: `whitespace-pre flex-1 overflow-x-auto px-4 py-3`,
        copyButton: `w-14 ${CenterClass}`,
    };

    return (
        <div class={styles.container}>
            <pre class={styles.pre}>{props.text}</pre>
            <div class={styles.copyButton}>
                <CopyButton text={props.text} />
            </div>
        </div>
    );
}
