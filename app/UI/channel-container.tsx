import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { PopChannel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.tsx";

import { PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { IconButtonClass } from "./components/tw.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";

export type Social_Model = {
    currentChannel: string | undefined;
};

interface Kind1Getter {
    getEvents(relay: string): NostrEvent<NostrKind.TEXT_NOTE>[];
}

type ChannelContainerProps = {
    relay: SingleRelayConnection;
    bus: EventBus<UI_Interaction_Event>;
    // kind1Getter: Kind1Getter;
} & Social_Model;

type ChannelContainerState = {} & Social_Model;

export class ChannelContainer extends Component<ChannelContainerProps, ChannelContainerState> {
    changes?: PopChannel<UI_Interaction_Event>;

    state: ChannelContainerState = {
        currentChannel: undefined,
    };

    componentWillUpdate(nextProps: Readonly<ChannelContainerProps>): void {
        this.setState({
            currentChannel: nextProps.currentChannel,
        });
    }

    async componentDidMount() {
        this.setState({
            currentChannel: this.props.currentChannel,
        });
    }

    componentWillUnmount(): void {
        if (this.changes) {
            this.changes.close();
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
                        class={`flex items-center w-full h-20  text-xl text-[${PrimaryTextColor}] p-1 border-b border-[#36393F]`}
                    >
                        {this.props.relay.url}
                    </div>
                    <ChannelList
                        channels={["general", "games", "work"]}
                        eventSub={this.props.bus}
                        emit={this.props.bus.emit}
                    />
                </div>
                {this.state.currentChannel
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                currentChannel={this.state.currentChannel}
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
    currentChannel: string;
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
                    {props.currentChannel}
                </span>
            </div>
        </div>
    );
}
