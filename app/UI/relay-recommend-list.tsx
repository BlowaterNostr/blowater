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

export class RelayRecommendList extends Component {
    render() {
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
                    {recommendedRelays.map((r) => {
                        return (
                            <li
                                class={`w-[80%] px-[1rem] py-[0.75rem] rounded-lg bg-[${DividerBackgroundColor}80] mb-[0.5rem]  flex items-center justify-between cursor-pointer hover:bg-[${HoverButtonBackgroudColor}]`}
                            >
                                <div class={`flex items-center flex-1 overflow-hidden`}>
                                    <span class={`truncate`}>{r}</span>
                                </div>
                                <button
                                    class={`w-[2rem] h-[2rem] rounded-lg bg-transparent hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        // const p = props.relayConfig.add(r.url);
                                        // this.setState({
                                        //     relayStatus: this.computeRelayStatus(props),
                                        // });
                                        // props.emit({
                                        //     type: "RelayConfigChange",
                                        //     kind: "add",
                                        //     url: r.url,
                                        // });
                                        // const relay = await p;
                                        // if (relay instanceof Error) {
                                        //     console.error(relay);
                                        //     return;
                                        // }
                                    }}
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
