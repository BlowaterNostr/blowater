import { Component, h } from "https://esm.sh/preact@10.17.1";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { emitFunc, EventBus } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { setState } from "./_helper.ts";
import { ProfileGetter } from "./search.tsx";

import { RelayRecordGetter } from "../database.ts";
import { NewMessageChecker } from "./conversation-list.tsx";
import { ConversationListRetriever } from "./conversation-list.tsx";
import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";

import { MessagePanel } from "./message-panel.tsx";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { ChatMessage } from "./message.ts";
import { func_GetEventByID } from "./message-list.tsx";
import { PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { PublicFilterList } from "./channel-list.tsx";
import { Filter, FilterContent } from "./filter.tsx";

export type Public_Model = {
    relaySelectedChannel: Map<string, /* relay url */ string /* channel name */>;
};

export type func_IsUserBlocked = (pubkey: PublicKey) => boolean;

type Props = {
    ctx: NostrAccountContext;
    relay: SingleRelayConnection;
    bus: EventBus<UI_Interaction_Event>;
    messages: ChatMessage[];
    getters: {
        profileGetter: ProfileGetter;
        convoListRetriever: ConversationListRetriever;
        newMessageChecker: NewMessageChecker;
        relayRecordGetter: RelayRecordGetter;
        isUserBlocked: func_IsUserBlocked;
        getEventByID: func_GetEventByID;
    };
} & Public_Model;

type State = {
    currentSelectedChannel: string /*channel name*/ | undefined;
    currentEditor: {
        text: string;
    };
    filter: FilterContent | undefined;
};

export class PublicMessageContainer extends Component<Props, State> {
    state: State = {
        currentSelectedChannel: "general",
        currentEditor: {
            text: "",
        },
        filter: undefined,
    };

    async componentDidMount() {
        for await (const e of this.props.bus.onChange()) {
            if (e.type == "SelectRelay") {
                await setState(this, {
                    currentSelectedChannel: "general", // this.props.relaySelectedChannel.get(e.relay.url),
                });
            } else if (e.type == "BackToChannelList") {
                // await setState(this, {
                //     currentSelectedChannel: undefined,
                // });
            } else if (e.type == "FilterContent") {
                await setState(this, {
                    filter: e,
                });
            }
        }
    }

    render(props: Props, state: State) {
        let msgs = props.messages;
        const filter = this.state.filter;
        if (filter) {
            msgs = this.props.messages.filter((msg) => {
                if (filter.content == "") {
                    return true;
                }
                return msg.content.toLowerCase().includes(filter.content.toLowerCase());
            });
        }
        return (
            <div class="flex flex-row h-full w-full flex bg-[#36393F] overflow-hidden">
                {this.state.currentSelectedChannel
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                currentSelected={state.currentSelectedChannel}
                                emit={props.bus.emit}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                {
                                    <MessagePanel
                                        key={props.relay.url}
                                        myPublicKey={props.ctx.publicKey}
                                        emit={props.bus.emit}
                                        eventSub={props.bus}
                                        getters={props.getters}
                                        messages={msgs}
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
    currentSelected: string | undefined;
    emit: emitFunc<FilterContent>;
}) {
    return (
        <div
            class={`h-14 border-l border-b border-[#36393F] flex
                items-center justify-between bg-[#2F3136]`}
        >
            <div class={`flex items-center overflow-hidden`}>
                <span
                    class={`text-[#F3F4EA] text-[1.2rem] mx-4
                            whitespace-nowrap truncate`}
                >
                    {props.currentSelected}
                </span>
                <div>
                    <Filter {...props}></Filter>
                </div>
            </div>
        </div>
    );
}
