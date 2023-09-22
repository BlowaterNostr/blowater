/** @jsx h */
import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { computed, signal } from "https://esm.sh/@preact/signals@1.2.1";
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
import { RelayIcon } from "./icons2/relay-icon.tsx";
import { DeleteIcon } from "./icons2/delete-icon.tsx";
import { RelayConfig } from "./relay-config.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { emitFunc } from "../event-bus.ts";

export interface SettingProps {
    logout: () => void;
    relayConfig: RelayConfig;
    relayPool: ConnectionPool;
    myAccountContext: NostrAccountContext;
    emit: emitFunc<RelayConfigChange>;
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
    return (
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
    );
};

const error = signal("");
const addRelayInput = signal("");
const relayStatus = signal<{ url: string; status: keyof typeof colors }[]>([]);
export type RelayConfigChange = {
    type: "RelayConfigChange";
};

type RelaySettingProp = {
    relayConfig: RelayConfig;
    relayPool: ConnectionPool;
    emit: emitFunc<RelayConfigChange>;
};

export class RelaySetting extends Component<RelaySettingProp> {
    render(props: RelaySettingProp) {
        function computeRelayStatus() {
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

        (async () => {
            console.log("relayConfig.syncWithPool", props.relayConfig, props.relayPool);
            const err = await props.relayConfig.syncWithPool(props.relayPool);
            if (err != undefined) {
                error.value = err.map((e) => e.message).join("\n");
            }
            relayStatus.value = computeRelayStatus();
        })();

        relayStatus.value = computeRelayStatus();

        const addRelay = async () => {
            // props.eventBus.emit({ type: "AddRelay" });
            console.log("add", addRelayInput.value);
            if (addRelayInput.value.length > 0) {
                props.relayConfig.add(addRelayInput.value);
                addRelayInput.value = "";
                relayStatus.value = computeRelayStatus();
                const err = await props.relayConfig.syncWithPool(props.relayPool);
                if (err != undefined) {
                    error.value = err.map((e) => e.message).join("\n");
                }
                relayStatus.value = computeRelayStatus();
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
                        onInput={(e) => {
                            addRelayInput.value = e.currentTarget.value;
                            console.log("|", addRelayInput.value);
                        }}
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
                {error.value
                    ? <p class={tw`mt-2 text-[${ErrorColor}] text-[0.875rem]`}>{error.value}</p>
                    : undefined}

                <ul class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>
                    {computed(() => {
                        return relayStatus.value.map((r) => {
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
                                        onClick={async function remove() {
                                            props.relayConfig.remove(r.url);
                                            relayStatus.value = computeRelayStatus();
                                            const err = await props.relayConfig.syncWithPool(props.relayPool);
                                            if (err != undefined) {
                                                error.value = err.map((e) => e.message).join("\n");
                                            }
                                            relayStatus.value = computeRelayStatus();
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
                        });
                    })}
                </ul>
            </Fragment>
        );
    }
}
