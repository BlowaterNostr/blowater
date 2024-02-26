import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";

import { PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { IconButtonClass } from "./components/tw.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";

interface Kind1Getter {
    getEvents(relay: string): NostrEvent<NostrKind.TEXT_NOTE>[];
}

type ChannelContainerProps = {
    relay: SingleRelayConnection;
    // kind1Getter: Kind1Getter;
};

// NOTE: Temporary type, which may change later
export type ChannelModel = {
    tag: string;
};

type ChannelContainerState = {
    currentChannel: ChannelModel;
};

export class ChannelContainer extends Component<ChannelContainerProps, ChannelContainerState> {
    componentDidUpdate(
        previousProps: Readonly<ChannelContainerProps>,
        previousState: Readonly<ChannelContainerState>,
        snapshot: any,
    ): void {
        console.log(this.props.relay);
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
                    <ChannelList channels={["general", "games", "work"]}></ChannelList>
                </div>
                {!this.state.currentChannel
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                currentChannel={this.state.currentChannel}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                <ChannelMessagePanel></ChannelMessagePanel>
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
    currentChannel: ChannelModel;
}) {
    return (
        <div
            class={`h-14 border-l border-b border-[#36393F] flex
                items-center justify-between bg-[#2F3136]`}
        >
            <div class={`flex items-center overflow-hidden`}>
                <button
                    onClick={() => {
                        // props.bus.emit({
                        //     type: "BackToContactList",
                        // });
                    }}
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
                    onClick={() => {
                        // if (!props.currentEditor) {
                        //     return;
                        // }
                        // props.bus.emit({
                        //     type: "ViewUserDetail",
                        //     pubkey: props.currentEditor.pubkey,
                        // });
                    }}
                >
                    {props.currentChannel ? props.currentChannel.tag : "Channel Name"}
                </span>
            </div>
        </div>
    );
}
