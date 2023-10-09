/** @jsx h */
import { h, VNode } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import * as cl from "./conversation-list.tsx";
import { MessagePanel, RightPanelModel } from "./message-panel.tsx";
import { EventBus } from "../event-bus.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { CenterClass, IconButtonClass } from "./components/tw.ts";
import { DirectMessageGetter, GroupMessageGetter, UI_Interaction_Event } from "./app_update.tsx";
import { NostrAccountContext, NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { getFocusedContent } from "./app.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { PrimaryTextColor } from "./style/colors.ts";
import { SettingIcon } from "./icons2/setting-icon.tsx";
import { GroupMessageController } from "../features/gm.ts";
import { ProfileGetter } from "./search.tsx";
import { InviteIcon } from "./icons2/invite-icon.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { convertEventsToChatMessages } from "../features/dm.ts";
import { ChatMessage } from "./message.ts";
import { EditorModel } from "./editor.tsx";

export type DM_Model = {
    currentEditor: EditorModel | undefined;
    focusedContent: Map<string, NostrEvent /* thread root event */ | PublicKey /* selected user profile */>;
    isGroupMessage: boolean;
};

type DirectMessageContainerProps = {
    rightPanelModel: RightPanelModel;
    ctx: NostrAccountContext;
    pool: ConnectionPool;
    bus: EventBus<UI_Interaction_Event>;
    profilesSyncer: ProfileSyncer;
    eventSyncer: EventSyncer;
    groupChatController: GroupMessageController;
    // getters
    profileGetter: ProfileGetter;
    dmGetter: DirectMessageGetter;
    gmGetter: GroupMessageGetter;
    pinListGetter: cl.PinListGetter;
    conversationLists: cl.ConversationListRetriever;
    newMessageChecker: cl.NewMessageChecker;
} & DM_Model;

export type StartInvite = {
    type: "StartInvite";
    publicKey: PublicKey;
};

export function DirectMessageContainer(props: DirectMessageContainerProps) {
    const t = Date.now();

    let messagePanel: VNode | undefined;
    if (props.currentEditor && props.currentEditor) {
        const convoMsgs = getConversationMessages({
            targetPubkey: props.currentEditor.pubkey.hex,
            isGroupChat: props.isGroupMessage,
            dmGetter: props.dmGetter,
            gmGetter: props.gmGetter,
        });

        const focusedContent = getFocusedContent(
            props.focusedContent.get(props.currentEditor.pubkey.hex),
            props.profileGetter,
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
            editorModel: props.currentEditor,
        }).render();
    }

    const currentEditor = props.currentEditor;
    const canEditGroupProfile = currentEditor && props.isGroupMessage &&
        props.groupChatController.getGroupAdminCtx(currentEditor.pubkey);
    const actions = canEditGroupProfile
        ? (
            <ButtonGroup>
                <button
                    class={tw`w-8 h-8 ${CenterClass}`}
                    onClick={() => {
                        props.bus.emit({
                            type: "StartInvite",
                            publicKey: currentEditor.pubkey,
                        });
                    }}
                >
                    <InviteIcon
                        class={tw`w-6 h-6 text-[${PrimaryTextColor}] fill-current`}
                    />
                </button>
                <button
                    class={tw`w-8 h-8 ${CenterClass}`}
                    onClick={() => {
                        props.bus.emit({
                            type: "StartEditGroupChatProfile",
                            publicKey: currentEditor.pubkey,
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
        : undefined;
    const vDom = (
        <div
            class={tw`h-full w-full flex bg-[#36393F] overflow-hidden`}
        >
            <div class={tw`${props.currentEditor ? "mobile:hidden" : "mobile:w-full"}`}>
                <cl.ConversationList
                    eventBus={props.bus}
                    emit={props.bus.emit}
                    convoListRetriever={props.conversationLists}
                    groupChatListGetter={props.groupChatController}
                    hasNewMessages={props.newMessageChecker}
                    {...props}
                />
            </div>
            {props.currentEditor
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
                                    {props.profileGetter.getProfilesByPublicKey(props.currentEditor.pubkey)
                                        ?.profile.name ||
                                        props.currentEditor.pubkey.bech32()}
                                </span>
                            </div>
                            {props.isGroupMessage ? actions : undefined}
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

export function getConversationMessages(args: {
    targetPubkey: string;
    isGroupChat: boolean;
    dmGetter: DirectMessageGetter;
    gmGetter: GroupMessageGetter;
}): ChatMessage[] {
    const { targetPubkey } = args;
    if (args.isGroupChat) {
        return args.gmGetter.getGroupMessages(args.targetPubkey);
    }

    let messages = args.dmGetter.getDirectMessages(targetPubkey);
    return messages;
}
