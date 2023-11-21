/** @jsx h */
import { Component, ComponentChildren, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
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
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { Loading } from "./components/loading.tsx";
import { RelayIcon } from "./icons/relay-icon.tsx";

type Detail = {
    name?: string;
    description?: string;
    pubkey?: string;
    contact?: string;
    supported_nips?: number[];
    software?: string;
    version?: string;
};

type State = {
    detail: Detail;
    error: string;
    isLoading: boolean;
};

type Props = {
    relayUrl: string;
    profileGetter: ProfileGetter;
};

export type RelayDetailItem = {
    title: string;
    field: ComponentChildren;
};

export class RelayDetail extends Component<Props, State> {
    styles = {
        container: tw`bg-[${SecondaryBackgroundColor}] p-8`,
        title: tw`pt-8 text-[${PrimaryTextColor}]`,
        error: tw`text-[${ErrorColor}] ${CenterClass}`,
        header: {
            container: tw`text-lg flex text-[${PrimaryTextColor}] pb-4`,
            icon: tw`w-8 h-8 mr-4 text-[${TitleIconColor}] stroke-current`,
        },
    };

    state: State = {
        detail: {
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
        const res = await this.fetchData();
        if (res instanceof Error) {
            this.setState({
                isLoading: false,
                error: res.message,
            });
        } else {
            this.setState({
                isLoading: false,
                detail: res,
            });
        }
    }

    fetchData = async () => {
        const url = this.props.relayUrl;
        try {
            const httpURL = new URL(url);
            httpURL.protocol = "https";
            const res = await fetch(httpURL, {
                headers: {
                    "Accept": "application/nostr+json",
                },
            });

            if (!res.ok) {
                return new Error(`Faild to get detail from relay: ${httpURL}`);
            }

            const detail: Detail = await res.json();
            return detail;
        } catch (e) {
            return e;
        }
    };

    render() {
        const items: RelayDetailItem[] = [
            {
                title: "Admin",
                field: this.state.detail.pubkey &&
                    (
                        <AuthorField
                            publicKey={this.state.detail.pubkey}
                            profileGetter={this.props.profileGetter}
                        />
                    ),
            },
            {
                title: "Contact",
                field: this.state.detail.contact && <TextField text={this.state.detail.contact} />,
            },
            {
                title: "Description",
                field: this.state.detail.description && <TextField text={this.state.detail.description} />,
            },
            {
                title: "Software",
                field: this.state.detail.software && <TextField text={this.state.detail.software} />,
            },
            {
                title: "Version",
                field: this.state.detail.version && <TextField text={this.state.detail.version} />,
            },
            {
                title: "Supported Nips",
                field: this.state.detail.supported_nips && (
                    <TextField text={this.state.detail.supported_nips.join(",")} />
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
        container: tw`flex items-center ${InputClass}`,
        avatar: tw`h-8 w-8 mr-2`,
        icon: tw`w-4 h-4 text-[${HintTextColor}] fill-current rotate-180`,
        name: tw`overflow-x-auto flex-1`,
    };

    const pubkey = PublicKey.FromString(props.publicKey);
    if (pubkey instanceof Error) {
        return null;
    }
    const profileData = props.profileGetter.getProfilesByPublicKey(pubkey);

    return (
        <Fragment>
            <div class={styles.container}>
                <Avatar picture={profileData?.profile.picture} class={styles.avatar} />
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
        container: tw`relative ${InputClass} resize-none flex p-0 mt-4`,
        pre: tw`whitespace-pre flex-1 overflow-x-auto px-4 py-3`,
        copyButton: tw`w-14 ${CenterClass}`,
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
