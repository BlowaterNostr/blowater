/** @jsx h */
import { Component, h, VNode } from "https://esm.sh/preact@10.17.1";
import { PopChannel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrAccountContext, NostrEvent } from "../../libs/nostr.ts/nostr.ts";
import { RelayRecordGetter } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { getFocusedContent } from "./app.tsx";
import { ChatMessagesGetter, UI_Interaction_Event, UserBlocker } from "./app_update.tsx";
import { IconButtonClass } from "./components/tw.ts";
import { NostrKind } from "../../libs/nostr.ts/nostr.ts";

import { EditorModel } from "./editor.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { MessagePanel } from "./message-panel.tsx";
import { ProfileGetter } from "./search.tsx";

import {
    ConversationList,
    ConversationListRetriever,
    NewMessageChecker,
    PinListGetter,
} from "./conversation-list.tsx";
import { ChatMessage } from "./message.ts";

export type DM_Model = {
    currentEditor: EditorModel | undefined;
    focusedContent: Map<string, NostrEvent | PublicKey>;
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
    };
    eventSyncer: EventSyncer;
    userBlocker: UserBlocker;
} & DM_Model;

export type StartInvite = {
    type: "StartInvite";
    publicKey: PublicKey;
};

type State = {
    currentEditor: EditorModel | undefined;
};

export class DirectMessageContainer extends Component<DirectMessageContainerProps, State> {
    changes?: PopChannel<UI_Interaction_Event>;

    state: State = {
        currentEditor: undefined,
    };

    componentWillUpdate(nextProps: Readonly<DirectMessageContainerProps>): void {
        this.setState({
            currentEditor: nextProps.currentEditor,
        });
    }

    async componentDidMount() {
        this.setState({
            currentEditor: this.props.currentEditor,
        });
    }

    componentWillUnmount(): void {
        if (this.changes) {
            this.changes.close();
        }
    }

    render(props: DirectMessageContainerProps) {
        const t = Date.now();
        console.log(DirectMessageContainer.name, "?");
        const vDom = (
            <div
                class={`h-full w-full flex bg-[#36393F] overflow-hidden`}
            >
                <div
                    class={`w-fit max-sm:w-full
                    ${props.currentEditor ? "max-sm:hidden" : ""}`}
                >
                    <ConversationList
                        eventSub={props.bus}
                        emit={props.bus.emit}
                        getters={props.getters}
                        userBlocker={props.userBlocker}
                    />
                </div>

                {this.state.currentEditor
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                bus={this.props.bus}
                                buttons={[]}
                                currentEditor={this.state.currentEditor}
                                profileGetter={this.props.getters.profileGetter}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                <MessagePanel
                                    myPublicKey={props.ctx.publicKey}
                                    emit={props.bus.emit}
                                    eventSub={props.bus}
                                    focusedContent={getFocusedContent(
                                        props.focusedContent.get(this.state.currentEditor.pubkey.hex),
                                        props.getters.profileGetter,
                                    )}
                                    eventSyncer={props.eventSyncer}
                                    profileGetter={props.getters.profileGetter}
                                    editorModel={this.state.currentEditor}
                                    kind={NostrKind.DIRECT_MESSAGE}
                                    messages={props.getters.messageGetter.getChatMessages(
                                        this.state.currentEditor.pubkey.hex,
                                    )}
                                    relayRecordGetter={props.getters.relayRecordGetter}
                                    userBlocker={props.userBlocker}
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
    currentEditor: EditorModel;
    profileGetter: ProfileGetter;
    buttons: VNode[];
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
                        if (!props.currentEditor) {
                            return;
                        }
                        props.bus.emit({
                            type: "ViewUserDetail",
                            pubkey: props.currentEditor.pubkey,
                        });
                    }}
                >
                    {props.profileGetter.getProfilesByPublicKey(
                        props.currentEditor.pubkey,
                    )
                        ?.profile.name ||
                        props.currentEditor.pubkey.bech32()}
                </span>
            </div>
            <div>
                {props.buttons}

                <button
                    class={`absolute z-10 w-6 h-6 transition-transform duration-100 ease-in-out
                            right-4 mobile:right-0 top-4 ${IconButtonClass}`}
                    onClick={() => {
                        props.bus.emit({
                            type: "ToggleRightPanel",
                            show: true,
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
