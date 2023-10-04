/** @jsx h */
import { h, VNode } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import * as cl from "./conversation-list.tsx";
import { Database_Contextual_View } from "../database.ts";
import { MessagePanel, RightPanelModel } from "./message-panel.tsx";
import { emitFunc, EventBus } from "../event-bus.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { CenterClass, IconButtonClass } from "./components/tw.ts";
import { DM_EditorModel } from "./editor.tsx";
import { getConversationMessages, UI_Interaction_Event } from "./app_update.tsx";
import { NostrAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { getProfileEvent, ProfileSyncer } from "../features/profile.ts";
import { ChatMessage } from "./message.ts";
import { DM_Model } from "./dm.ts";
import { getFocusedContent } from "./app.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { ConversationLists } from "./conversation-list.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { PrimaryTextColor } from "./style/colors.ts";
import { SettingIcon } from "./icons2/setting-icon.tsx";
import { GroupChatController } from "../group-chat.ts";

type DirectMessageContainerProps = {
    editors: Map<string, DM_EditorModel>;
    rightPanelModel: RightPanelModel;
    ctx: NostrAccountContext;
    pool: ConnectionPool;
    bus: EventBus<UI_Interaction_Event>;
    db: Database_Contextual_View;
    conversationLists: ConversationLists;
    profilesSyncer: ProfileSyncer;
    eventSyncer: EventSyncer;
    pinListGetter: cl.PinListGetter;
    groupChatController: GroupChatController;
} & DM_Model;

export type MessageThread = {
    root: ChatMessage;
    replies: ChatMessage[];
};

export function DirectMessageContainer(props: DirectMessageContainerProps) {
    const t = Date.now();
    const currentConversation = props.currentSelectedContact;
    let currentEditorModel: DM_EditorModel | undefined;
    if (currentConversation) {
        for (const [v, editor] of props.editors.entries()) {
            if (v == currentConversation.hex) {
                currentEditorModel = editor;
                const profile = getProfileEvent(props.db, currentConversation);
                currentEditorModel.target.receiver = {
                    pubkey: currentConversation,
                    name: profile?.profile.name,
                    picture: profile?.profile.picture,
                };
            }
        }
        if (currentEditorModel == undefined) {
            throw new Error("impossible state");
        }
    }

    let messagePanel: VNode | undefined;
    if (currentEditorModel) {
        const convoMsgs = getConversationMessages({
            targetPubkey: currentEditorModel.target.receiver.pubkey.hex,
            allUserInfo: props.conversationLists.convoSummaries,
            dmGetter: props.db,
        });
        console.log("DirectMessageContainer:convoMsgs", Date.now() - t);

        const focusedContent = (() => {
            let _ = getFocusedContent(
                props.focusedContent.get(currentEditorModel.target.receiver.pubkey.hex),
                props.conversationLists.convoSummaries,
                convoMsgs,
            );
            if (_?.type == "MessageThread") {
                let editor = props.editors.get(_.data.root.event.id);
                if (editor == undefined) {
                    editor = {
                        id: _.data.root.event.id,
                        files: [],
                        text: "",
                        tags: [
                            ["e", _.data.root.event.id],
                        ],
                        target: {
                            kind: NostrKind.DIRECT_MESSAGE,
                            receiver: currentEditorModel.target.receiver,
                        },
                    };
                    props.editors.set(editor.id, editor);
                }
                return {
                    ..._,
                    editor,
                };
            }
            return _;
        })();
        messagePanel = new MessagePanel({
            myPublicKey: props.ctx.publicKey,
            messages: convoMsgs,
            rightPanelModel: props.rightPanelModel,
            emit: props.bus.emit,
            editorModel: currentEditorModel,
            focusedContent: focusedContent,
            db: props.db,
            profilesSyncer: props.profilesSyncer,
            eventSyncer: props.eventSyncer,
            allUserInfo: props.conversationLists.convoSummaries,
        }).render();
    }
    const canEditGroupProfile = currentConversation && props.isGroupMessage &&
        props.groupChatController.getGroupAdminCtx(currentConversation);

    const vDom = (
        <div
            class={tw`h-full w-full flex bg-[#36393F] overflow-hidden`}
        >
            <div class={tw`${currentConversation ? "mobile:hidden" : "mobile:w-full"}`}>
                <cl.ConversationList
                    eventBus={props.bus}
                    emit={props.bus.emit}
                    convoListRetriever={props.conversationLists}
                    {...props}
                />
            </div>
            {currentConversation
                ? (
                    <div class={tw`flex-1 overflow-hidden flex-col flex`}>
                        <div
                            class={tw`h-14 border-l border-b border-[#36393F] flex items-center justify-between px-5 bg-[#2F3136]`}
                        >
                            <div class={tw`flex items-center`}>
                                <button
                                    onClick={() => {
                                        props.bus.emit({
                                            type: "BackToContactList",
                                        });
                                    }}
                                    class={tw`w-6 h-6 mr-4 desktop:hidden ${IconButtonClass}`}
                                >
                                    <LeftArrowIcon
                                        class={tw`w-4 h-4`}
                                        style={{
                                            fill: "rgb(185, 187, 190)",
                                        }}
                                    />
                                </button>
                                <span class={tw`text-[#F3F4EA] text-[1.2rem] whitespace-nowrap truncate`}>
                                    {currentEditorModel?.target.receiver.name ||
                                        currentConversation.bech32()}
                                </span>
                            </div>
                            {canEditGroupProfile
                                ? (
                                    <ButtonGroup>
                                        <button
                                            class={tw`w-8 h-8 ${CenterClass}`}
                                            onClick={() => {
                                                props.bus.emit({
                                                    type: "StartEditGroupChatProfile",
                                                    publicKey: currentConversation,
                                                });
                                            }}
                                        >
                                            <SettingIcon
                                                class={tw`w-6 h-6 text-[${PrimaryTextColor}] stroke-current`}
                                                style={{ fill: "none" }}
                                            />
                                        </button>
                                    </ButtonGroup>
                                )
                                : undefined}
                        </div>
                        <div class={tw`flex-1 overflow-x-auto`}>
                            {messagePanel}
                        </div>
                    </div>
                )
                : undefined}
        </div>
    );
    console.debug("DirectMessageContainer:end", Date.now() - t);
    return vDom;
}
