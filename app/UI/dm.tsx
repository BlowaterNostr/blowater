/** @jsx h */
import { Component, h, VNode } from "https://esm.sh/preact@10.17.1";
import { PopChannel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrAccountContext, NostrEvent } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { RelayRecordGetter } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { GroupMessageController } from "../features/gm.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { getFocusedContent } from "./app.tsx";
import { ChatMessagesGetter, UI_Interaction_Event, UserBlocker } from "./app_update.tsx";
import { CenterClass, IconButtonClass } from "./components/tw.ts";
import { IS_BETA_VERSION } from "./config.js";
import { EditorModel } from "./editor.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { SettingIcon } from "./icons/setting-icon.tsx";
import { UserIcon } from "./icons/user-icon.tsx";
import { InviteButton } from "./invite-button.tsx";
import { MessagePanel, NewMessageListener } from "./message-panel.tsx";
import { ProfileGetter } from "./search.tsx";
import { PrimaryTextColor } from "./style/colors.ts";
import {
    ConversationList,
    ConversationListRetriever,
    NewMessageChecker,
    PinListGetter,
} from "./conversation-list.tsx";

export type DM_Model = {
    currentEditor: EditorModel | undefined;
    focusedContent: Map<string, NostrEvent | PublicKey>;
};

type DirectMessageContainerProps = {
    ctx: NostrAccountContext;
    bus: EventBus<UI_Interaction_Event>;
    profilesSyncer: ProfileSyncer;
    eventSyncer: EventSyncer;
    groupChatController: GroupMessageController;
    // getters
    profileGetter: ProfileGetter;
    messageGetter: ChatMessagesGetter;
    newMessageListener: NewMessageListener;
    pinListGetter: PinListGetter;
    conversationLists: ConversationListRetriever;
    newMessageChecker: NewMessageChecker;
    relayRecordGetter: RelayRecordGetter;
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

        const changes = this.props.bus.onChange();
        this.changes = changes;
        for await (const change of changes) {
            if (change.type == "SelectConversation") {
                // todo
            }
        }
    }

    componentWillUnmount(): void {
        if (this.changes) {
            this.changes.close();
        }
    }

    render(props: DirectMessageContainerProps) {
        const t = Date.now();

        const currentEditor = props.currentEditor;
        let buttons = [];
        if (currentEditor && IS_BETA_VERSION) {
            buttons.push(
                <InviteButton
                    groupChatController={props.groupChatController}
                    profileGetter={props.profileGetter}
                    userPublicKey={currentEditor.pubkey}
                    emit={props.bus.emit}
                />,
            );
        }

        const vDom = (
            <div
                class={`h-full w-full flex bg-[#36393F] overflow-hidden`}
            >
                <div
                    class={`w-fit
                    max-sm:w-full
                    ${props.currentEditor ? "max-sm:hidden" : ""}`}
                >
                    <ConversationList
                        eventBus={props.bus}
                        emit={props.bus.emit}
                        convoListRetriever={props.conversationLists}
                        hasNewMessages={props.newMessageChecker}
                        {...props}
                        userBlocker={props.userBlocker}
                    />
                </div>

                {this.state.currentEditor
                    ? (
                        <div class={`flex flex-col flex-1 overflow-hidden`}>
                            <TopBar
                                bus={this.props.bus}
                                buttons={buttons}
                                currentEditor={this.state.currentEditor}
                                profileGetter={this.props.profileGetter}
                            />
                            <div class={`flex-1 overflow-auto`}>
                                <MessagePanel
                                    myPublicKey={props.ctx.publicKey}
                                    emit={props.bus.emit}
                                    eventSub={props.bus}
                                    newMessageListener={props.newMessageListener}
                                    focusedContent={getFocusedContent(
                                        props.focusedContent.get(this.state.currentEditor.pubkey.hex),
                                        props.profileGetter,
                                    )}
                                    profilesSyncer={props.profilesSyncer}
                                    eventSyncer={props.eventSyncer}
                                    profileGetter={props.profileGetter}
                                    editorModel={this.state.currentEditor}
                                    messageGetter={props.messageGetter}
                                    relayRecordGetter={props.relayRecordGetter}
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
