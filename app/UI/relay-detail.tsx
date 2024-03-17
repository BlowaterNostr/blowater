/** @jsx h */
import { Component, ComponentChildren, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { CopyButton } from "./components/copy-button.tsx";
import { CenterClass, InputClass } from "./components/tw.ts";
import {
    BackgroundColor_HoverButton,
    ErrorColor,
    HintTextColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
    TitleIconColor,
} from "./style/colors.ts";
import { Avatar } from "./components/avatar.tsx";
import { ProfileGetter } from "./search.tsx";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { Loading } from "./components/loading.tsx";
import { RelayIcon } from "./icons/relay-icon.tsx";
import { Profile_Nostr_Event } from "../nostr.ts";
import { emitFunc } from "../event-bus.ts";
import { SelectConversation } from "./search_model.ts";

export type RelayInformation = {
    name?: string;
    description?: string;
    pubkey?: string;
    contact?: string;
    supported_nips?: number[];
    software?: string;
    version?: string;
    icon?: string;
};

type State = {
    relayInfo: RelayInformation;
    error: string;
    isLoading: boolean;
};

type Props = {
    relayUrl: string;
    profileGetter: ProfileGetter;
    emit: emitFunc<SelectConversation>;
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
        relayInfo: {
            name: undefined,
            description: undefined,
            pubkey: undefined,
            contact: undefined,
            supported_nips: undefined,
            software: undefined,
            version: undefined,
        },
        error: "",
        isLoading: false,
    };

    async componentWillMount() {
        this.setState({
            isLoading: true,
        });
        const res = await getRelayInformation(this.props.relayUrl);
        if (res instanceof Error) {
            this.setState({
                isLoading: false,
                error: res.message,
            });
        } else {
            this.setState({
                isLoading: false,
                relayInfo: res,
            });
        }
    }

    render() {
        let vNode;
        if (this.state.isLoading) {
            vNode = <Loading />;
        } else if (this.state.error) {
            vNode = <p class={this.styles.error}>{this.state.error}</p>;
        } else {
            const nodes = [];
            if (this.state.relayInfo.pubkey) {
                const pubkey = PublicKey.FromString(this.state.relayInfo.pubkey);
                if (pubkey instanceof Error) {
                } else {
                    nodes.push(
                        <Fragment>
                            <p class={this.styles.title}>Admin</p>
                            <AuthorField
                                publicKey={pubkey}
                                profileData={this.props.profileGetter.getProfilesByPublicKey(pubkey)}
                                emit={this.props.emit}
                            />
                        </Fragment>,
                    );
                }
            }
            if (this.state.relayInfo.contact) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Contact</p>
                        <TextField text={this.state.relayInfo.contact} />
                    </Fragment>,
                );
            }
            if (this.state.relayInfo.description) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Description</p>
                        <TextField text={this.state.relayInfo.description} />
                    </Fragment>,
                );
            }
            if (this.state.relayInfo.software) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Software</p>
                        <TextField text={this.state.relayInfo.software} />
                    </Fragment>,
                );
            }
            if (this.state.relayInfo.version) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Version</p>
                        <TextField text={this.state.relayInfo.version} />
                    </Fragment>,
                );
            }
            if (this.state.relayInfo.supported_nips) {
                nodes.push(
                    <Fragment>
                        <p class={this.styles.title}>Supported NIPs</p>
                        <TextField text={this.state.relayInfo.supported_nips.join(", ")} />
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
                    {this.state.relayInfo.icon
                        ? (
                            <Avatar
                                class="w-8 h-8 mr-2"
                                picture={this.state.relayInfo.icon || robohash(this.props.relayUrl)}
                            />
                        )
                        : undefined}
                    {this.state.relayInfo.name}
                    <div class="mx-2"></div>
                    {this.props.relayUrl}
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

export async function getRelayInformation(url: string) {
    try {
        const httpURL = new URL(url);
        httpURL.protocol = "https";
        const res = await fetch(httpURL, {
            headers: {
                "accept": "application/nostr+json",
            },
        });

        if (!res.ok) {
            return new Error(`Faild to get detail, ${res.status}: ${await res.text()}`);
        }

        const detail = await res.text();
        const info = JSON.parse(detail) as RelayInformation;
        if (!info.icon) {
            info.icon = robohash(url);
        }
        return info;
    } catch (e) {
        return e as Error;
    }
}

export function robohash(url: string | URL) {
    return `https://robohash.org/${url}`;
}
