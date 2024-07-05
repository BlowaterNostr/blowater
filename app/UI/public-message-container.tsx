/* @jsx h */
import { Component, h } from "preact";
import { emitFunc, EventBus } from "../event-bus.ts";
import { ChatMessagesGetter, UI_Interaction_Event } from "./app_update.tsx";
import { setState } from "./_helper.ts";

import { RelayRecordGetter } from "../database.ts";
import { NewMessageChecker } from "./conversation-list.tsx";
import { ConversationListRetriever } from "./conversation-list.tsx";
import { NostrAccountContext } from "@blowater/nostr-sdk";

import { MessagePanel } from "./message-panel.tsx";
import { PublicKey } from "@blowater/nostr-sdk";
import { ChatMessage } from "./message.ts";
import { func_GetEventByID, func_GetReactionsByEventID, func_IsAdmin } from "./message-list.tsx";
import { Filter, FilterContent } from "./filter.tsx";
import { NoteID } from "@blowater/nostr-sdk";
import { func_GetProfileByPublicKey, func_GetProfilesByText } from "./search.tsx";

export type Public_Model = {
    relaySelectedChannel: Map<string, /* relay url */ string /* channel name */>;
};

export type func_IsUserBlocked = (pubkey: PublicKey) => boolean;

type Props = {
    ctx: NostrAccountContext;
    relay_url: string;
    bus: EventBus<UI_Interaction_Event>;
    messages: ChatMessage[];
    getters: {
        messageGetter: ChatMessagesGetter;
        getProfileByPublicKey: func_GetProfileByPublicKey;
        getProfilesByText: func_GetProfilesByText;
        convoListRetriever: ConversationListRetriever;
        newMessageChecker: NewMessageChecker;
        relayRecordGetter: RelayRecordGetter;
        isUserBlocked: func_IsUserBlocked;
        getEventByID: func_GetEventByID;
        isAdmin: func_IsAdmin | undefined;
        getReactionsByEventID: func_GetReactionsByEventID;
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
            if (e.type == "FilterContent") {
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
            msgs = filter_messages(this.props.messages, filter);
        }
        return (
            <div class="flex flex-row h-full flex-1 flex bg-[#36393F] overflow-hidden">
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
                                        key={props.relay_url}
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

function filter_messages(msgs: ChatMessage[], filter: FilterContent) {
    const filter_string = filter.content.trim().toLocaleLowerCase();
    const pubkey = PublicKey.FromBech32(filter_string);
    const is_pubkey = pubkey instanceof PublicKey;
    const noteID = NoteID.FromBech32(filter_string);
    const is_note = noteID instanceof NoteID;
    msgs = msgs.filter((msg) => {
        if (is_pubkey) {
            if (msg.author.hex == pubkey.hex) {
                return true;
            }
        }
        if (is_note) {
            if (msg.event.id == noteID.hex) {
                return true;
            }
        }
        if (msg.content.toLocaleLowerCase().indexOf(filter_string) != -1) {
            return true;
        }
        return false;
    });
    return msgs;
}
