import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { setState } from "./_helper.ts";
import { ProfileGetter } from "./search.tsx";
import { EditorModel } from "./editor.tsx";
import { RelayRecordGetter } from "../database.ts";
import { NewMessageChecker } from "./conversation-list.tsx";
import { ChatMessagesGetter } from "./app_update.tsx";
import { ConversationListRetriever } from "./conversation-list.tsx";
import { NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { EventSyncer } from "./event_syncer.ts";
import { UserBlocker } from "./app_update.tsx";

import { PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { IconButtonClass } from "./components/tw.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { MessagePanel } from "./message-panel.tsx";

export type Social_Model = {
    currentChannel: string | undefined;
    relaySelectedChannel: Map<string, /* relay url */ string /* channel name */>;
};

type ChannelContainerProps = {
    ctx: NostrAccountContext;
    relay: SingleRelayConnection;
    bus: EventBus<UI_Interaction_Event>;
    getters: {
        profileGetter: ProfileGetter;
        messageGetter: ChatMessagesGetter;
        convoListRetriever: ConversationListRetriever;
        newMessageChecker: NewMessageChecker;
        relayRecordGetter: RelayRecordGetter;
    };
    eventSyncer: EventSyncer;
    userBlocker: UserBlocker;
} & Social_Model;

type ChannelContainerState = {
    currentSelectedChannel: string /*channel name*/ | undefined;
    currentEditor: EditorModel;
};

export class ChannelContainer extends Component<ChannelContainerProps, ChannelContainerState> {
    state: ChannelContainerState = {
        currentSelectedChannel: this.initialSelected(),
        currentEditor: this.initialCurrentEditor(),
    };

    initialSelected() {
        return this.props.relaySelectedChannel.get(this.props.relay.url);
    }

    initialCurrentEditor() {
        return {
            pubkey: this.props.ctx.publicKey,
            text: "",
            files: [],
        };
    }

    async componentDidMount() {
        for await (const e of this.props.bus.onChange()) {
            if (e.type == "SelectChannel") {
                await setState(this, {
                    currentSelectedChannel: e.channel,
                });
            } else if (e.type == "SelectRelay") {
                await setState(this, {
                    currentSelectedChannel: this.props.relaySelectedChannel.get(e.relay.url),
                });
            } else if (e.type == "BackToChannelList") {
                await setState(this, {
                    currentSelectedChannel: undefined,
                });
            }
        }
    }

    render(props: ChannelContainerProps, state: ChannelContainerState) {
        return (
            <div class="flex flex-row h-full w-full flex bg-[#36393F] overflow-hidden">
                <div
                    class={`h-screen w-60 max-sm:w-full
                        flex flex-col bg-[${SecondaryBackgroundColor}]  `}
                >
                    <div
                        class={`flex items-center w-full h-20 font-bold text-xl text-[${PrimaryTextColor}] m-1 p-3 border-b border-[#36393F]`}
                    >
                        {props.relay.url}
                    </div>
                    <ChannelList
                        relay={props.relay.url}
                        currentSelected={state.currentSelectedChannel}
                        channels={["general", "games", "work"]}
                        emit={props.bus.emit}
                    />
                </div>
                {this.state.currentSelectedChannel
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                bus={props.bus}
                                currentSelected={state.currentSelectedChannel}
                                profileGetter={props.getters.profileGetter}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                {
                                    <MessagePanel
                                        myPublicKey={props.ctx.publicKey}
                                        emit={props.bus.emit}
                                        eventSub={props.bus}
                                        focusedContent={undefined}
                                        eventSyncer={props.eventSyncer}
                                        profileGetter={props.getters.profileGetter}
                                        editorModel={state.currentEditor}
                                        kind={NostrKind.TEXT_NOTE}
                                        messages={props.getters.messageGetter.getChatMessages(
                                            props.ctx.publicKey.hex,
                                        )}
                                        relayRecordGetter={props.getters.relayRecordGetter}
                                        userBlocker={props.userBlocker}
                                    />
                                }
                            </div>
                        </div>
                    )
                    : undefined}
            </div>
        );
    }
}

function TopBar(props: {
    bus: EventBus<UI_Interaction_Event>;
    currentSelected: string | undefined;
    profileGetter: ProfileGetter;
}) {
    return (
        <div
            class={`h-14 border-l border-b border-[#36393F] flex
                items-center justify-between bg-[#2F3136]`}
        >
            <div class={`flex items-center overflow-hidden`}>
                <button
                    onClick={() => {
                        props.bus.emit({
                            type: "BackToChannelList",
                        });
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
                >
                    {props.currentSelected}
                </span>
            </div>
        </div>
    );
}
