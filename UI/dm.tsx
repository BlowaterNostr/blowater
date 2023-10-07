/** @jsx h */
import { h, VNode } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import * as cl from "./conversation-list.tsx";
import { MessagePanel, RightPanelModel } from "./message-panel.tsx";
import { EventBus } from "../event-bus.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { CenterClass, IconButtonClass } from "./components/tw.ts";
import { DirectMessageGetter, getConversationMessages, UI_Interaction_Event } from "./app_update.tsx";
import { NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { ChatMessage } from "./message.ts";
import { DM_Model } from "./dm.ts";
import { getFocusedContent } from "./app.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { ConversationLists } from "./conversation-list.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { PrimaryTextColor } from "./style/colors.ts";
import { SettingIcon } from "./icons2/setting-icon.tsx";
import { GroupChatController } from "../group-chat.ts";
import { ProfileGetter } from "./search.tsx";
import { EditorModel } from "./editor.tsx";

type DirectMessageContainerProps = {
    rightPanelModel: RightPanelModel;
    ctx: NostrAccountContext;
    pool: ConnectionPool;
    bus: EventBus<UI_Interaction_Event>;
    profileGetter: ProfileGetter;
    dmGetter: DirectMessageGetter;
    conversationLists: ConversationLists;
    profilesSyncer: ProfileSyncer;
    eventSyncer: EventSyncer;
    pinListGetter: cl.PinListGetter;
    groupChatController: GroupChatController;
    editorModel: EditorModel | undefined;
} & DM_Model;

export type MessageThread = {
    root: ChatMessage;
    replies: ChatMessage[];
};

export function DirectMessageContainer(props: DirectMessageContainerProps) {
    const t = Date.now();

    let messagePanel: VNode | undefined;
    if (props.currentSelectedContact && props.editorModel) {
        const convoMsgs = getConversationMessages({
            targetPubkey: props.currentSelectedContact.hex,
            allUserInfo: props.conversationLists.convoSummaries,
            dmGetter: props.dmGetter,
        });
        console.log("DirectMessageContainer:convoMsgs", Date.now() - t);

        const focusedContent = getFocusedContent(
            props.focusedContent.get(props.currentSelectedContact.hex),
            props.conversationLists.convoSummaries,
            convoMsgs,
        );
        messagePanel = new MessagePanel({
            myPublicKey: props.ctx.publicKey,
            messages: convoMsgs,
            rightPanelModel: props.rightPanelModel,
            emit: props.bus.emit,
            focusedContent: focusedContent,
            profilesSyncer: props.profilesSyncer,
            eventSyncer: props.eventSyncer,
            isGroupChat: props.isGroupMessage,
            profileGetter: props.profileGetter,
            editorModel: props.editorModel,
        }).render();
    }
    const canEditGroupProfile = props.currentSelectedContact && props.isGroupMessage &&
        props.groupChatController.getGroupAdminCtx(props.currentSelectedContact);

    const vDom = (
        <div
            class={tw`h-full w-full flex bg-[#36393F] overflow-hidden`}
        >
            <div class={tw`${props.currentSelectedContact ? "mobile:hidden" : "mobile:w-full"}`}>
                <cl.ConversationList
                    eventBus={props.bus}
                    emit={props.bus.emit}
                    convoListRetriever={props.conversationLists}
                    {...props}
                />
            </div>
            {props.currentSelectedContact
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
                                    {props.profileGetter.getProfilesByPublicKey(props.currentSelectedContact)
                                        ?.profile.name ||
                                        props.currentSelectedContact.bech32()}
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
                                                    // @ts-ignore
                                                    publicKey: props.currentSelectedContact,
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
