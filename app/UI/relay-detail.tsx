/** @jsx h */
import { Component, Fragment, h } from "preact";
import { CopyButton } from "./components/copy-button.tsx";
import { CenterClass, InputClass } from "./components/tw.ts";
import { ErrorColor, HintTextColor, PrimaryTextColor } from "./style/colors.ts";
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
import { CloseIcon } from "./icons/close-icon.tsx";
import { HideModal } from "./components/modal.tsx";
import { MembersIcon } from "./icons/members-icon.tsx";
import { GeneralIcon } from "./icons/general-icon.tsx";

type SpaceSettingProps = {
    spaceUrl: URL;
    emit: emitFunc<SelectConversation | ViewUserDetail | HideModal>;
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

    render(props: SpaceSettingProps, state: SpaceSettingState) {
        return (
            <div class="h-[60dvh] w-[95dvw] sm:w-[80dvw] md:w-[60dvw] bg-neutral-700 rounded-xl text-[#fff] text-sm font-sans font-medium leading-5">
                <div class="w-full h-full flex flex-col p-[1rem]">
                    <div class="flex flex-row grow">
                        <div class="text-xl font-semibold leading-7 flex-1">Space Settings</div>
                        <button
                            class="w-6 min-w-[1.5rem] h-6 focus:outline-none focus-visible:outline-none rounded-full hover:bg-neutral-500 z-10 flex items-center justify-center "
                            onClick={async () => {
                                await props.emit({
                                    type: "HideModal",
                                });
                            }}
                        >
                            <CloseIcon
                                class={`w-4 h-4`}
                                style={{
                                    stroke: "rgb(185, 187, 190)",
                                }}
                            />
                        </button>
                    </div>
                    <div class="flex flex-row h-[90%]">
                        <div class="h-full flex flex-col pr-[1rem]">
                            <div
                                class={`flex flex-row items-center gap-2 p-2 hover:bg-neutral-500 rounded-lg mt-2 hover:cursor-pointer ${
                                    state.tab == "general" ? "bg-neutral-600" : "text-neutral-300"
                                }`}
                                onClick={this.changeTab("general")}
                            >
                                <GeneralIcon class="w-6 h-6" />
                                <div>General</div>
                            </div>
                            <div
                                class={`flex flex-row items-center gap-2 p-2 hover:bg-neutral-500 rounded-lg mt-2 hover:cursor-pointer ${
                                    state.tab == "members" ? "bg-neutral-600" : "text-neutral-300"
                                }`}
                                onClick={this.changeTab("members")}
                            >
                                <MembersIcon class="w-6 h-6" />
                                <div>Members</div>
                            </div>
                        </div>
                        <div class="overflow-y-auto grow">
                            {this.state.tab == "general"
                                ? this.state.info == undefined ? <Loading /> : (
                                    <RelayInformationComponent
                                        {...this.props}
                                        info={{
                                            ...this.state.info,
                                            url: this.props.spaceUrl,
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
    info: RelayInformation & { url: URL };
};

export class RelayInformationComponent extends Component<Props, State> {
    styles = {
        container: `p-8`,
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
                    console.log("RelayInfomationComponent", pubkey, this.props.info.url);

                    nodes.push(
                        <Fragment>
                            <p class={this.styles.title}>Admin</p>
                            <AuthorField
                                publicKey={pubkey}
                                profileData={this.props.getProfileByPublicKey(pubkey, this.props.info.url)}
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
                    const profile = props.getProfileByPublicKey(member, props.space_url);
                    return (
                        <div
                            class="w-full flex items-center px-4 py-2 hover:bg-neutral-500 rounded-lg cursor-pointer"
                            onClick={this.clickSpaceMember(member)}
                        >
                            <Avatar
                                class={`flex-shrink-0 w-8 h-8 mr-2 bg-[#fff] rounded-full`}
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
                class={`flex items-center ${InputClass} border-neutral-600 mt-4 hover:bg-neutral-500 hover:cursor-pointer`}
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
        container: `relative ${InputClass} border-neutral-600 resize-none flex p-0 mt-4`,
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
