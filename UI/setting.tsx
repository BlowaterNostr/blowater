/** @jsx h */
import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";

import {
    CenterClass,
    inputBorderClass,
    InputClass,
    LinearGradientsClass,
    NoOutlineClass,
} from "./components/tw.ts";
import KeyView from "./key-view.tsx";
import { InMemoryAccountContext, NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import {
    DividerBackgroundColor,
    ErrorColor,
    HoverButtonBackgroudColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
    SuccessColor,
    TitleIconColor,
    WarnColor,
} from "./style/colors.ts";
import { RelayIcon } from "./icons/relay-icon.tsx";
import { DeleteIcon } from "./icons/delete-icon.tsx";
import { RelayConfig } from "./relay-config.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { emitFunc } from "../event-bus.ts";

export interface SettingProps {
    logout: () => void;
    relayConfig: RelayConfig;
    relayPool: ConnectionPool;
    myAccountContext: NostrAccountContext;
    emit: emitFunc<RelayConfigChange>;
    show: boolean;
}

const colors = {
    "Connecting": WarnColor,
    "Open": SuccessColor,
    "Closing": WarnColor,
    "Closed": ErrorColor,
    "Not In Pool": ErrorColor,
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
            class={tw`flex-1 overflow-hidden overflow-y-auto`}
        >
            <div class={tw`min-w-full min-h-full px-2 bg-[${SecondaryBackgroundColor}]`}>
                <div class={tw`max-w-[41rem] m-auto py-[1.5rem]`}>
                    <div class={tw`px-[1rem] py-[1.5rem] ${inputBorderClass} rounded-lg mt-[1.5rem]`}>
                        <RelaySetting
                            emit={props.emit}
                            relayConfig={props.relayConfig}
                            relayPool={props.relayPool}
                        >
                        </RelaySetting>
                    </div>

                    <div
                        class={tw`px-[1rem] py-[0.5rem] ${inputBorderClass} rounded-lg mt-[1.5rem] text-[${PrimaryTextColor}]`}
                    >
                        <KeyView
                            privateKey={priKey}
                            publicKey={props.myAccountContext.publicKey}
                        />
                    </div>
                    <button
                        class={tw`w-full p-[0.75rem] mt-[1.5rem] rounded-lg ${NoOutlineClass} ${CenterClass} ${LinearGradientsClass}  hover:bg-gradient-to-l text-[${PrimaryTextColor}]`}
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
};

type RelaySettingProp = {
    relayConfig: RelayConfig;
    relayPool: ConnectionPool;
    emit: emitFunc<RelayConfigChange>;
};

type RelaySettingState = {
    error: string;
    addRelayInput: string;
    relayStatus: { url: string; status: keyof typeof colors }[];
};

export class RelaySetting extends Component<RelaySettingProp, RelaySettingState> {
    state: Readonly<RelaySettingState> = {
        error: "",
        addRelayInput: "",
        relayStatus: [],
    };

    async componentDidMount() {
        console.log(`${RelaySetting.name}::componentDidMount`);
        const err = await this.props.relayConfig.syncWithPool(this.props.relayPool);
        if (err != undefined) {
            this.setState({
                error: err.message,
            });
        }
        this.setState({
            relayStatus: this.computeRelayStatus(this.props),
        });
    }

    computeRelayStatus(props: RelaySettingProp) {
        const _relayStatus: { url: string; status: keyof typeof colors }[] = [];
        for (const url of props.relayConfig.getRelayURLs()) {
            const relay = props.relayPool.getRelay(url);
            let status: keyof typeof colors = "Not In Pool";
            if (relay) {
                status = relay.ws.status();
            }
            _relayStatus.push({
                url,
                status,
            });
        }
        return _relayStatus;
    }

    render(props: RelaySettingProp) {
        const addRelayInput = this.state.addRelayInput;

        const relayStatus = this.computeRelayStatus(props);

        const addRelay = async () => {
            // props.eventBus.emit({ type: "AddRelay" });
            console.log("add", addRelayInput);
            if (addRelayInput.length > 0) {
                props.relayConfig.add(addRelayInput);
                this.setState({
                    addRelayInput: "",
                });
                this.setState({
                    relayStatus: this.computeRelayStatus(props),
                });
                const err = await props.relayConfig.syncWithPool(props.relayPool);
                if (err != undefined) {
                    this.setState({
                        error: err.message,
                    });
                }
                this.setState({
                    relayStatus: this.computeRelayStatus(props),
                });
                props.emit({ type: "RelayConfigChange" });
            }
        };
        return (
            <Fragment>
                <p class={tw`text-[1.3125rem] flex text-[${PrimaryTextColor}]`}>
                    <RelayIcon
                        class={tw`w-[2rem] h-[2rem] mr-[1rem]`}
                        style={{
                            stroke: TitleIconColor,
                        }}
                    />
                    Relays
                </p>
                <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>
                    Add Relay
                </p>
                <div class={tw`mt-[0.5rem] flex text-[${PrimaryTextColor}]`}>
                    <input
                        autofocus={true}
                        onInput={(e) => this.setState({ addRelayInput: e.currentTarget.value })}
                        value={addRelayInput}
                        placeholder="wss://"
                        type="text"
                        class={tw`${InputClass}`}
                    />
                    <button
                        class={tw`ml-[0.75rem] w-[5.9375rem] h-[3rem] p-[0.75rem] rounded-lg ${NoOutlineClass} bg-[${DividerBackgroundColor}] hover:bg-[${HoverButtonBackgroudColor}] ${CenterClass} text-[${PrimaryTextColor}]`}
                        onClick={addRelay}
                    >
                        Add
                    </button>
                </div>
                {this.state.error
                    ? <p class={tw`mt-2 text-[${ErrorColor}] text-[0.875rem]`}>{this.state.error}</p>
                    : undefined}

                <ul class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                    {relayStatus.map((r) => {
                        return (
                            <li
                                class={tw`w-full px-[1rem] py-[0.75rem] rounded-lg bg-[${DividerBackgroundColor}80] mb-[0.5rem]  flex items-center justify-between`}
                            >
                                <div class={tw`flex items-center flex-1 overflow-hidden`}>
                                    <span
                                        class={tw`bg-[${
                                            colors[r.status]
                                        }] text-center block py-1 px-2 rounded text-[0.8rem] mr-2 font-bold`}
                                    >
                                        {r.status}
                                    </span>
                                    <span class={tw`truncate`}>{r.url}</span>
                                </div>

                                <button
                                    class={tw`w-[2rem] h-[2rem] rounded-lg bg-transparent hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                                    onClick={async () => {
                                        props.relayConfig.remove(r.url);
                                        this.setState({
                                            relayStatus: this.computeRelayStatus(props),
                                        });
                                        const err = await props.relayConfig.syncWithPool(props.relayPool);
                                        if (err != undefined) {
                                            this.setState({
                                                error: err.message,
                                            });
                                        }
                                        this.setState({
                                            relayStatus: this.computeRelayStatus(props),
                                        });
                                        props.emit({ type: "RelayConfigChange" });
                                    }}
                                >
                                    <DeleteIcon
                                        class={tw`w-[1rem] h-[1rem]`}
                                        style={{
                                            stroke: ErrorColor,
                                        }}
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </Fragment>
        );
    }
}
