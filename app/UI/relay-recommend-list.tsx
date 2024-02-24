/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { recommendedRelays } from "./relay-config.ts";
import { AddIcon } from "./icons/add-icon.tsx";
import { CenterClass, NoOutlineClass } from "./components/tw.ts";
import {
    DividerBackgroundColor,
    ErrorColor,
    HoverButtonBackgroudColor,
    PrimaryTextColor,
} from "./style/colors.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayConfigChange } from "./setting.tsx";
import { RelayConfig } from "./relay-config.ts";

type RelayRecommendListProps = {
    relayConfig: RelayConfig;
    emit: emitFunc<RelayConfigChange>;
};

type RelayRecommendListState = {
    relays: string[];
};

export class RelayRecommendList extends Component<RelayRecommendListProps, RelayRecommendListState> {
    constructor(props: RelayRecommendListProps) {
        super(props);
        this.state = {
            relays: this.computeRecommendedRelays(),
        };
    }

    computeRecommendedRelays() {
        // remove the relays that are already in the relayConfig
        return recommendedRelays.filter((r) => !this.props.relayConfig.getRelayURLs().has(r));
    }

    handleAddRelay = (relayUrl: string) => {
        // There is no need to get the relay status here
        this.props.relayConfig.add(relayUrl);
        this.props.emit({
            type: "RelayConfigChange",
            kind: "add",
            url: relayUrl,
        });
        this.setState({ relays: this.computeRecommendedRelays() });
    };

    render(props: RelayRecommendListProps) {
        return (
            <div class={`text-[${PrimaryTextColor}] text-center`}>
                <div class={`text-lg mt-4`}>
                    Recommend Relays
                </div>
                <div class={`text-sm px-20 text-center`}>
                    Blowater automatically discovers relays as you browse the network. Adding more relays will
                    generally make things quicker to load, at the expense of higher data usage.
                </div>
                <ul
                    class={`mt-[0.5rem] text-[${PrimaryTextColor}] flex flex-col justify-center items-center w-full`}
                >
                    {this.state.relays.map((r) => {
                        return (
                            <li
                                class={`w-[80%] px-[1rem] py-[0.75rem] rounded-lg bg-[${DividerBackgroundColor}80] mb-[0.5rem]  flex items-center justify-between cursor-pointer hover:bg-[${HoverButtonBackgroudColor}]`}
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
