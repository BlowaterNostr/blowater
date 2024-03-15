/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { recommendedRelays } from "./relay-config.ts";
import { AddIcon } from "./icons/add-icon.tsx";
import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import {
    DividerBackgroundColor,
    ErrorColor,
    HoverButtonBackgroundColor,
    PrimaryTextColor,
} from "./style/colors.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayConfig } from "./relay-config.ts";
import { HidePopOver } from "./components/popover.tsx";

type RelayRecommendListProps = {
    relayConfig: RelayConfig;
    emit: emitFunc<HidePopOver>;
};

export class RelayRecommendList extends Component<RelayRecommendListProps> {
    computeRecommendedRelays() {
        // remove the relays that are already in the relayConfig
        return recommendedRelays.filter((r) => {
            return !this.props.relayConfig.getRelayURLs().has(r);
        });
    }

    handleAddRelay = async (relayUrl: string) => {
        const p = this.props.relayConfig.add(relayUrl);
        this.props.emit({
            type: "HidePopOver",
        });
        const relay = await p;
        if (relay instanceof Error) {
            console.error(relay);
            return;
        }
        this.forceUpdate();
    };

    render() {
        return (
            <div class={`text-[${PrimaryTextColor}] text-center`}>
                <div class={`text-lg mt-4`}>
                    Recommend Relays
                </div>
                <ul
                    class={`mt-[0.5rem] text-[${PrimaryTextColor}] flex flex-col justify-center items-center w-full`}
                >
                    {this.computeRecommendedRelays().map((r) => {
                        return (
                            <li
                                class={`w-[80%] px-[1rem] py-[0.75rem] rounded-lg bg-[${DividerBackgroundColor}80] mb-[0.5rem]  flex items-center justify-between cursor-pointer hover:bg-[${HoverButtonBackgroundColor}]`}
                            >
                                <div class={`flex items-center flex-1 overflow-hidden`}>
                                    <span class={`truncate`}>{r}</span>
                                </div>
                                <button
                                    class={`w-[2rem] h-[2rem] rounded-lg bg-transparent hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                                    onClick={() => this.handleAddRelay(r)}
                                >
                                    <AddIcon
                                        class={`w-[1rem] h-[1rem]`}
                                        style={{
                                            stroke: ErrorColor,
                                        }}
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }
}
