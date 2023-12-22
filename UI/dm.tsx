/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import * as cl from "./conversation-list.tsx";
import { MessagePanel, NewMessageListener } from "./message-panel.tsx";
import { EventBus } from "../event-bus.ts";
import { CenterClass, IconButtonClass } from "./components/tw.ts";
import { ChatMessagesGetter, UI_Interaction_Event } from "./app_update.tsx";
import { NostrAccountContext, NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { ProfileSyncer } from "../features/profile.ts";
import { getFocusedContent } from "./app.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { PrimaryTextColor } from "./style/colors.ts";
import { SettingIcon } from "./icons/setting-icon.tsx";
import { GroupMessageController } from "../features/gm.ts";
import { ProfileGetter } from "./search.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { EditorModel } from "./editor.tsx";
import { InviteButton } from "./invite-button.tsx";
import { IS_BETA_VERSION } from "./config.js";
import { UserIcon } from "./icons/user-icon.tsx";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import { RelayRecordGetter } from "../database.ts";
import { RightPanelModel } from "./right-panel.tsx";

export type DM_Model = {
    currentEditor: EditorModel | undefined;
    focusedContent: Map<string, NostrEvent | PublicKey>;
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
    messageGetter: ChatMessagesGetter;
    newMessageListener: NewMessageListener;
    pinListGetter: cl.PinListGetter;
    conversationLists: cl.ConversationListRetriever;
    newMessageChecker: cl.NewMessageChecker;
    relayRecordGetter: RelayRecordGetter;
} & DM_Model;

export type StartInvite = {
    type: "StartInvite";
    publicKey: PublicKey;
};

export function DirectMessageContainer(props: DirectMessageContainerProps) {
    const t = Date.now();

    const currentEditor = props.currentEditor;
    let buttons = [];
    if (currentEditor && IS_BETA_VERSION) {
        if (props.isGroupMessage) {
            buttons.push(
                <button
                    class={`w-8 h-8 ${CenterClass}`}
                    onClick={() => {
                        props.bus.emit({
                            type: "ViewUserDetail",
                            pubkey: currentEditor.pubkey,
                        });
                    }}
                >
                    <UserIcon
                        class={`w-6 h-6 text-[${PrimaryTextColor}] stroke-current`}
                        style={{ fill: "none" }}
                    />
                </button>,
            );

            const canEditGroupProfile = props.groupChatController.getGroupAdminCtx(currentEditor.pubkey);
            if (canEditGroupProfile) {
                buttons.push(
                    // setting button
                    <button
                        class={`w-8 h-8 ${CenterClass}`}
                        onClick={() => {
                            props.bus.emit({
                                type: "StartEditGroupChatProfile",
                                ctx: canEditGroupProfile,
                            });
                        }}
                    >
                        <SettingIcon
                            class={`w-6 h-6 text-[${PrimaryTextColor}] stroke-current`}
                            style={{ fill: "none" }}
                        />
                    </button>,
                );
            }
        } else {
            buttons.push(
                <InviteButton
                    groupChatController={props.groupChatController}
                    profileGetter={props.profileGetter}
                    userPublicKey={currentEditor.pubkey}
                    emit={props.bus.emit}
                />,
            );
        }
    }

    const vDom = (
        <div
            class={`h-full w-full flex bg-[#36393F] overflow-hidden`}
        >
            <div class={`${props.currentEditor ? "mobile:hidden" : "mobile:w-full"}`}>
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
                    <div class={`h-screen flex-1 overflow-hidden flex-col flex`}>
                        <div
                            class={`h-14 mobile:h-12
                            border-l border-b border-[#36393F] flex
                            items-center justify-between px- mobile:px-2 bg-[#2F3136]`}
                        >
                            <div class={`flex items-center overflow-hidden`}>
                                <button
                                    onClick={() => {
                                        props.bus.emit({
                                            type: "BackToContactList",
                                        });
                                    }}
                                    class={`w-6 h-6 mobile:mr-2 desktop:hidden ${IconButtonClass}`}
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
                                    ml-4 mobile:text-base whitespace-nowrap truncate`}
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
                                    {props.profileGetter.getProfilesByPublicKey(props.currentEditor.pubkey)
                                        ?.profile.name ||
                                        props.currentEditor.pubkey.bech32()}
                                </span>
                            </div>
                            <div>
                                {buttons}
                            </div>
                        </div>
                        <div class={`flex-1 overflow-x-auto`}>
                            {props.currentEditor
                                ? (
                                    <MessagePanel
                                        myPublicKey={props.ctx.publicKey}
                                        rightPanelModel={props.rightPanelModel}
                                        emit={props.bus.emit}
                                        newMessageListener={props.newMessageListener}
                                        focusedContent={getFocusedContent(
                                            props.focusedContent.get(props.currentEditor.pubkey.hex),
                                            props.profileGetter,
                                        )}
                                        profilesSyncer={props.profilesSyncer}
                                        eventSyncer={props.eventSyncer}
                                        isGroupMessage={props.isGroupMessage}
                                        profileGetter={props.profileGetter}
                                        editorModel={props.currentEditor}
                                        messageGetter={props.messageGetter}
                                        relayRecordGetter={props.relayRecordGetter}
                                    />
                                )
                                : undefined}
                        </div>
                    </div>
                )
                : undefined}
        </div>
    );
    console.debug("DirectMessageContainer:end", Date.now() - t);
    return vDom;
}
