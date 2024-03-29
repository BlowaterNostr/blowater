/** @jsx h */
import { Component, h, VNode } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { RelayRecordGetter } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { ChatMessagesGetter, UI_Interaction_Event, UserBlocker } from "./app_update.tsx";
import { IconButtonClass } from "./components/tw.ts";

import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { MessagePanel_V0 } from "./message-panel.tsx";
import { ProfileGetter } from "./search.tsx";

import {
    ConversationList,
    ConversationListRetriever,
    NewMessageChecker,
    PinListGetter,
} from "./conversation-list.tsx";
import { func_GetEventByID } from "./message-list.tsx";
import { ProfileCard } from "./profile-card.tsx";

export type DM_Model = {
    currentConversation: PublicKey | undefined;
};

type DirectMessageContainerProps = {
    ctx: NostrAccountContext;
    bus: EventBus<UI_Interaction_Event>;
    getters: {
        profileGetter: ProfileGetter;
        messageGetter: ChatMessagesGetter;
        pinListGetter: PinListGetter;
        convoListRetriever: ConversationListRetriever;
        newMessageChecker: NewMessageChecker;
        relayRecordGetter: RelayRecordGetter;
        isUserBlocked: (pubkey: PublicKey) => boolean;
        getEventByID: func_GetEventByID;
    };
    userBlocker: UserBlocker;
} & DM_Model;

export type StartInvite = {
    type: "StartInvite";
    publicKey: PublicKey;
};

export class DirectMessageContainer extends Component<DirectMessageContainerProps> {
    render(props: DirectMessageContainerProps) {
        const t = Date.now();
        console.log(DirectMessageContainer.name, "?");
        const vDom = (
            <div
                class={`h-full w-full flex bg-[#36393F] overflow-hidden`}
            >
                <div
                    class={`w-fit max-sm:w-full
                    ${props.currentConversation ? "max-sm:hidden" : ""}`}
                >
                    <ConversationList
                        eventSub={props.bus}
                        emit={props.bus.emit}
                        getters={props.getters}
                        userBlocker={props.userBlocker}
                    />
                </div>

                {this.props.currentConversation
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                bus={this.props.bus}
                                buttons={[]}
                                currentConversation={this.props.currentConversation}
                                profileGetter={this.props.getters.profileGetter}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                <MessagePanel_V0
                                    key={this.props.currentConversation}
                                    myPublicKey={props.ctx.publicKey}
                                    emit={props.bus.emit}
                                    eventSub={props.bus}
                                    getters={props.getters}
                                    messages={props.getters.messageGetter.getChatMessages(
                                        this.props.currentConversation.hex,
                                    )}
                                />
                            </div>
                        </div>
                    )
                    : undefined}
            </div>
        );
        console.debug("DirectMessageContainer:end", Date.now() - t);
        return vDom;
    }
}

function TopBar(props: {
    bus: EventBus<UI_Interaction_Event>;
    currentConversation: PublicKey;
    profileGetter: ProfileGetter;
    buttons: VNode[];
}) {
    const conversation_profile = props.profileGetter.getProfilesByPublicKey(
        props.currentConversation,
    );
    let conversation_name = conversation_profile?.profile.name ||
        conversation_profile?.profile.display_name ||
        props.currentConversation.bech32();
    return (
        <div
            class={`h-14 border-l border-b border-[#36393F] flex
                items-center justify-between bg-[#2F3136]`}
        >
            <div class={`flex items-center overflow-hidden`}>
                <button
                    onClick={() => {
                        props.bus.emit({
                            type: "BackToContactList",
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
                    // https://tailwindcss.com/docs/customizing-colors
                    // https://tailwindcss.com/docs/cursor
                    class={`text-[#F3F4EA] text-[1.2rem]
                            hover:text-[#60a5fa] hover:cursor-pointer
                            whitespace-nowrap truncate`}
                    onClick={() => {
                        if (!props.currentConversation) {
                            return;
                        }
                        props.bus.emit({
                            type: "ViewUserDetail",
                            pubkey: props.currentConversation,
                        });
                    }}
                >
                    {conversation_name}
                </span>
            </div>
            <div>
                {props.buttons}

                <button
                    class={`absolute z-10 w-6 h-6 transition-transform duration-100 ease-in-out
                            right-4 mobile:right-0 top-4 ${IconButtonClass}`}
                    onClick={() => {
                        props.bus.emit({
                            type: "ViewUserDetail",
                            pubkey: props.currentConversation,
                        });
                    }}
                >
                    <LeftArrowIcon
                        class={`w-4 h-4`}
                        style={{
                            fill: "#F3F4EA",
                        }}
                    />
                </button>
            </div>
        </div>
    );
}
