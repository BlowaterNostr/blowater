import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { setState } from "./_helper.ts";

import { PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { IconButtonClass } from "./components/tw.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";

export type Social_Model = {
    currentChannel: string | undefined;
    relaySelectedChannel: Map<Relay, Channel>;
};

type Relay = string;
type Channel = string;

type ChannelContainerProps = {
    relay: SingleRelayConnection;
    bus: EventBus<UI_Interaction_Event>;
} & Social_Model;

type ChannelContainerState = {
    currentSelected: Channel | undefined;
};

export class ChannelContainer extends Component<ChannelContainerProps, ChannelContainerState> {
    state: ChannelContainerState = {
        currentSelected: this.initialSelected(),
    };

    initialSelected() {
        return this.props.relaySelectedChannel.get(this.props.relay.url);
    }

    async componentDidMount() {
        for await (const e of this.props.bus.onChange()) {
            if (e.type == "SelectChannel") {
                await setState(this, {
                    currentSelected: e.channel,
                });
            } else if (e.type == "SelectRelay") {
                await setState(this, {
                    currentSelected: this.props.relaySelectedChannel.get(e.relay.url),
                });
            }
        }
    }

    render() {
        return (
            <div class="flex flex-row h-full w-full flex bg-[#36393F] overflow-hidden">
                <div
                    class={`h-screen w-60 max-sm:w-full
                        flex flex-col bg-[${SecondaryBackgroundColor}]  `}
                >
                    <div
                        class={`flex items-center w-full h-20 font-bold text-xl text-[${PrimaryTextColor}] m-1 p-3 border-b border-[#36393F]`}
                    >
                        {this.props.relay.url}
                    </div>
                    <ChannelList
                        relay={this.props.relay.url}
                        currentSelected={this.state.currentSelected}
                        channels={["general", "games", "work"]}
                        emit={this.props.bus.emit}
                    />
                </div>
                {this.state.currentSelected
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                currentSelected={this.state.currentSelected}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                <ChannelMessagePanel />
                            </div>
                        </div>
                    )
                    : undefined}
            </div>
        );
    }
}

type ChannelMessagePanelProps = {};

class ChannelMessagePanel extends Component<ChannelMessagePanelProps> {
    render(props: ChannelMessagePanelProps) {
        return (
            <div>
                ChannelMessagePanel
            </div>
        );
    }
}

function TopBar(props: {
    currentSelected: string | undefined;
}) {
    return (
        <div
            class={`h-14 border-l border-b border-[#36393F] flex
                items-center justify-between bg-[#2F3136]`}
        >
            <div class={`flex items-center overflow-hidden`}>
                <button
                    class={`w-6 h-6 mx-2 ${IconButtonClass}`}
                >
                    <LeftArrowIcon
                        class={`w-4 h-4`}
                        style={{
                            fill: "rgb(185, 187, 190)",
                        }}
                    />
                </button>
                <span
                    class={`text-[#F3F4EA] text-[1.2rem]
                            hover:text-[#60a5fa] hover:cursor-pointer
                            whitespace-nowrap truncate`}
                >
                    {props.currentSelected}
                </span>
            </div>
        </div>
    );
}
