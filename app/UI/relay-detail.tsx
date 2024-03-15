/** @jsx h */
import { Component, ComponentChildren, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { CopyButton } from "./components/copy-button.tsx";
import { CenterClass, InputClass } from "./components/tw.ts";
import {
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
};

export type RelayInfoItem = {
    title: string;
    field: ComponentChildren;
};

export class RelayInformationComponent extends Component<Props, State> {
    styles = {
        container: `bg-[${SecondaryBackgroundColor}] p-8`,
        title: `pt-8 text-[${PrimaryTextColor}]`,
        error: `text-[${ErrorColor}] ${CenterClass}`,
        header: {
            container: `text-lg flex text-[${PrimaryTextColor}] pb-4`,
            icon: `w-8 h-8 mr-4 text-[${TitleIconColor}] stroke-current`,
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
        const items: RelayInfoItem[] = [
            {
                title: "Admin",
                field: this.state.relayInfo.pubkey &&
                    (
                        <AuthorField
                            publicKey={this.state.relayInfo.pubkey}
                            profileGetter={this.props.profileGetter}
                        />
                    ),
            },
            {
                title: "Contact",
                field: this.state.relayInfo.contact && <TextField text={this.state.relayInfo.contact} />,
            },
            {
                title: "Description",
                field: this.state.relayInfo.description && (
                    <TextField text={this.state.relayInfo.description} />
                ),
            },
            {
                title: "Software",
                field: this.state.relayInfo.software && <TextField text={this.state.relayInfo.software} />,
            },
            {
                title: "Version",
                field: this.state.relayInfo.version && <TextField text={this.state.relayInfo.version} />,
            },
            {
                title: "Supported Nips",
                field: this.state.relayInfo.supported_nips && (
                    <TextField text={this.state.relayInfo.supported_nips.join(",")} />
                ),
            },
        ];

        let vNode;
        if (this.state.isLoading) {
            vNode = <Loading />;
        } else if (this.state.error) {
            vNode = <p class={this.styles.error}>{this.state.error}</p>;
        } else {
            vNode = items.map((item) => {
                if (item.field) {
                    return (
                        <Fragment>
                            <p class={this.styles.title}>{item.title}</p>
                            {item.field}
                        </Fragment>
                    );
                }
            });
        }

        return (
            <div class={this.styles.container}>
                <p class={this.styles.header.container}>
                    <RelayIcon class={this.styles.header.icon} />
                    Relay Detail -- {this.props.relayUrl}
                </p>
                {vNode}
            </div>
        );
    }
}

function AuthorField(props: {
    publicKey: string;
    profileGetter: ProfileGetter;
}) {
    const styles = {
        container: `flex items-center ${InputClass}`,
        avatar: `h-8 w-8 mr-2`,
        icon: `w-4 h-4 text-[${HintTextColor}] fill-current rotate-180`,
        name: `overflow-x-auto flex-1`,
    };

    const pubkey = PublicKey.FromString(props.publicKey);
    if (pubkey instanceof Error) {
        return null;
    }
    const profileData = props.profileGetter.getProfilesByPublicKey(pubkey);

    return (
        <Fragment>
            <div class={styles.container}>
                <Avatar
                    picture={profileData?.profile.picture || robohash(props.publicKey)}
                    class={styles.avatar}
                />
                <p class={styles.name}>{profileData?.profile.name || pubkey.bech32()}</p>
            </div>

            <TextField text={pubkey.bech32()} />
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
