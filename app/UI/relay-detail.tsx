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
import { ProfileGetter } from "./search.tsx";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { Loading } from "./components/loading.tsx";
import { Profile_Nostr_Event } from "../nostr.ts";
import { emitFunc } from "../event-bus.ts";
import { SelectConversation } from "./search_model.ts";
import { RelayInformation, robohash } from "../../libs/nostr.ts/nip11.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { setState } from "./_helper.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

type SpaceSettingState = {
    tab: tabs;
    info: RelayInformation | undefined;
};
type tabs = "general" | "members";

export class SpaceSetting extends Component<
    {
        emit: emitFunc<SelectConversation>;
        profileGetter: ProfileGetter;
        relay: SingleRelayConnection;
    },
    SpaceSettingState
> {
    infoStream: Channel<RelayInformation | Error> | undefined;
    state: SpaceSettingState = {
        tab: "general",
        info: undefined,
    };

    async componentDidMount() {
        this.infoStream = await this.props.relay.getRelayInformationStream();
        for await (const info of this.infoStream) {
            if (info instanceof Error) {
                console.error(info.message, info.cause);
            } else {
                await setState(this, {
                    info,
                });
            }
        }
    }

    async componentWillUnmount() {
        this.infoStream?.close();
    }

    render() {
        return (
            <div class="flex flex-row">
                <div class="flex flex-col">
                    <button class="border" onClick={this.changeTab("general")}>General</button>
                    <button class="border" onClick={this.changeTab("members")}>Members</button>
                </div>
                {this.state.tab == "general"
                    ? this.state.info == undefined ? <Loading /> : (
                        <RelayInformationComponent
                            {...this.props}
                            info={{
                                ...this.state.info,
                                url: this.props.relay.url,
                            }}
                        />
                    )
                    : <div>Member List</div>}
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
    profileGetter: ProfileGetter;
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
                } else {
                    nodes.push(
                        <Fragment>
                            <p class={this.styles.title}>Admin</p>
                            <AuthorField
                                publicKey={pubkey}
                                profileData={this.props.profileGetter.getProfileByPublicKey(pubkey)}
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
