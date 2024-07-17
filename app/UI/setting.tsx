/** @jsx h */
import { Component, Fragment, h } from "preact";

import {
    CenterClass,
    inputBorderClass,
    InputClass,
    LinearGradientsClass,
    NoOutlineClass,
} from "./components/tw.ts";
import KeyView from "./key-view.tsx";

import {
    DividerBackgroundColor,
    ErrorColor,
    HoverButtonBackgroundColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
    SuccessColor,
    TitleIconColor,
    WarnColor,
} from "./style/colors.ts";
import { RelayIcon } from "./icons/relay-icon.tsx";
import { DeleteIcon } from "./icons/delete-icon.tsx";
import { default_blowater_relay, RelayConfig } from "./relay-config.ts";
import { emitFunc } from "../event-bus.ts";
import { sleep } from "@blowater/csp";
import { ConnectionPool, InMemoryAccountContext, NostrAccountContext, PrivateKey } from "@blowater/nostr-sdk";
import { ValueSet } from "@blowater/collections";
import { url_identity } from "./_helper.ts";

export interface SettingProps {
    logout: () => void;
    relayConfig: RelayConfig;
    relayPool: ConnectionPool;
    myAccountContext: NostrAccountContext;
    emit: emitFunc<RelayConfigChange | ViewSpaceSettings | ViewRecommendedRelaysList>;
    show: boolean;
}

const colors = {
    "Connecting": WarnColor,
    "Open": SuccessColor,
    "Closing": WarnColor,
    "Closed": ErrorColor,
};

export const Setting = (props: SettingProps) => {
    let priKey: PrivateKey | undefined;
    const ctx = props.myAccountContext;
    if (ctx instanceof InMemoryAccountContext) {
        priKey = ctx.privateKey;
    }
    if (props.show == false) {
        return undefined;
    }
    return (
        <div
            class={`flex-1 overflow-y-auto`}
        >
            <div class={`min-w-full min-h-full px-2 bg-[${SecondaryBackgroundColor}]`}>
                <div class={`max-w-[41rem] m-auto py-[1.5rem]`}>
                    <div class={`px-[1rem] py-[1.5rem] ${inputBorderClass} rounded-lg mt-[1.5rem]`}>
                        <RelaySetting
                            emit={props.emit}
                            getRelayURLs={props.relayConfig.getRelayURLs}
                            relayPool={props.relayPool}
                        >
                        </RelaySetting>
                    </div>

                    <div
                        class={`px-[1rem] py-[0.5rem] ${inputBorderClass} rounded-lg mt-[1.5rem] text-[${PrimaryTextColor}]`}
                    >
                        <KeyView
                            privateKey={priKey}
                            publicKey={props.myAccountContext.publicKey}
                        />
                    </div>
                    <button
                        class={`w-full p-[0.75rem] mt-[1.5rem] rounded-lg ${NoOutlineClass} ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l text-[${PrimaryTextColor}]`}
                        onClick={props.logout}
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export type RelayConfigChange = {
    type: "RelayConfigChange";
    kind: "add" | "remove";
    url: URL;
};

export type ViewSpaceSettings = {
    type: "ViewSpaceSettings";
    url: string | URL;
};

export type ViewRecommendedRelaysList = {
    type: "ViewRecommendedRelaysList";
};

export type func_GetRelayURLs = () => Array<URL>;

type RelaySettingProp = {
    getRelayURLs: func_GetRelayURLs;
    relayPool: ConnectionPool;
    emit: emitFunc<RelayConfigChange | ViewSpaceSettings | ViewRecommendedRelaysList>;
};

type RelaySettingState = {
    error: string;
    addRelayInput: string;
    relayStatus: { url: URL; status: keyof typeof colors }[];
};

export class RelaySetting extends Component<RelaySettingProp, RelaySettingState> {
    state: Readonly<RelaySettingState> = {
        error: "",
        addRelayInput: "",
        relayStatus: [],
    };
    private exit = false;

    async componentDidMount() {
        while (this.exit == false) {
            await sleep(333);
            const status = this.computeRelayStatus(this.props);
            this.setState({
                relayStatus: status,
            });
        }
    }

    componentWillUnmount(): void {
        this.exit == true;
    }

    computeRelayStatus(props: RelaySettingProp) {
        const _relayStatus: { url: URL; status: keyof typeof colors }[] = [];
        for (const url of props.getRelayURLs()) {
            const relay = props.relayPool.getRelay(url);
            let status: keyof typeof colors = "Closed";
            if (relay) {
                status = relay.status();
            }
            _relayStatus.push({
                url,
                status,
            });
        }
        return _relayStatus;
    }

    viewSpaceSettings = (url: URL) => {
        this.props.emit({
            type: "ViewSpaceSettings",
            url: url,
        });
    };

    showRecommendedRelaysList = () => {
        this.props.emit({
            type: "ViewRecommendedRelaysList",
        });
    };

    render(props: RelaySettingProp) {
        let addRelayInput = this.state.addRelayInput;

        const relayStatus = this.computeRelayStatus(props);

        const addRelay = async () => {
            console.log("add", addRelayInput);
            if (addRelayInput.length < 0) {
                return;
            }
            this.setState({
                addRelayInput: "",
                relayStatus: this.computeRelayStatus(props),
            });
            if (!addRelayInput.startsWith("wss://") || !addRelayInput.startsWith("ws://")) {
                addRelayInput = "wss://" + addRelayInput;
            }
            props.emit({
                type: "RelayConfigChange",
                kind: "add",
                url: new URL(addRelayInput),
            });
        };

        return (
            <Fragment>
                <p class={`text-[1.3125rem] flex text-[${PrimaryTextColor}]`}>
                    <RelayIcon
                        class={`w-[2rem] h-[2rem] mr-[1rem]`}
                        style={{
                            stroke: TitleIconColor,
                        }}
                    />
                    Relays
                </p>
                <p class={`mt-[1.75rem] text-[${PrimaryTextColor}]`}>
                    Add Relay
                </p>
                <div class={`mt-[0.5rem] flex text-[${PrimaryTextColor}]`}>
                    <input
                        autofocus={true}
                        onInput={(e) => this.setState({ addRelayInput: e.currentTarget.value })}
                        value={addRelayInput}
                        placeholder="wss://"
                        type="text"
                        class={`${InputClass}`}
                    />
                    <button
                        class={`ml-[0.75rem] w-[5.9375rem] h-[3rem] p-[0.75rem] rounded-lg ${NoOutlineClass} bg-[${DividerBackgroundColor}] hover:bg-[${HoverButtonBackgroundColor}] ${CenterClass} text-[${PrimaryTextColor}]`}
                        onClick={addRelay}
                    >
                        Add
                    </button>
                </div>
                {this.state.error
                    ? <p class={`mt-2 text-[${ErrorColor}] text-[0.875rem]`}>{this.state.error}</p>
                    : undefined}

                <ul class={`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                    {relayStatus.map((r) => {
                        return (
                            <li
                                onClick={() => this.viewSpaceSettings(r.url)}
                                class={`w-full px-[1rem] py-[0.75rem] rounded-lg bg-[${DividerBackgroundColor}80] mb-[0.5rem]  flex items-center justify-between cursor-pointer hover:bg-[${HoverButtonBackgroundColor}]`}
                            >
                                <div class={`flex items-center flex-1 overflow-hidden`}>
                                    <span
                                        class={`bg-[${
                                            colors[r.status]
                                        }] text-center block py-1 px-2 rounded text-[0.8rem] mr-2 font-bold`}
                                    >
                                        {r.status}
                                    </span>
                                    <span class={`truncate`}>{r.url.host}</span>
                                </div>
                                {url_identity(r.url) != url_identity(default_blowater_relay)
                                    ? (
                                        <button
                                            class={`w-[2rem] h-[2rem] rounded-lg bg-transparent hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                                            onClick={this.removeRelay(props, r.url)}
                                        >
                                            <DeleteIcon
                                                class={`w-[1rem] h-[1rem] text-[${ErrorColor}]`}
                                            />
                                        </button>
                                    )
                                    : undefined}
                            </li>
                        );
                    })}
                </ul>
                <button
                    class={`w-full p-[0.75rem] mt-[1.5rem] rounded-lg ${NoOutlineClass} ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l text-[${PrimaryTextColor}]`}
                    onClick={this.showRecommendedRelaysList}
                >
                    View Recommended Relays
                </button>
            </Fragment>
        );
    }

    removeRelay = (props: RelaySettingProp, url: URL) => async (e: Event) => {
        e.stopPropagation();
        this.setState({
            relayStatus: this.computeRelayStatus(props),
        });
        props.emit({
            type: "RelayConfigChange",
            kind: "remove",
            url: url,
        });
    };
}
