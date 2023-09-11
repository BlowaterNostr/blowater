/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { emitFunc, EventEmitter } from "../event-bus.ts";
import {
    DirectMessagePanelUpdate,
    NameAndTime,
    ParseMessageContent,
    Time,
    ViewThread,
    ViewUserDetail,
} from "./message-panel.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { ChatMessage, groupContinuousMessages } from "./message.ts";
import { Editor, EditorEvent, EditorModel } from "./editor.tsx";
import { Database_Contextual_View } from "../database.ts";
import { getUserInfoFromPublicKey, UserInfo } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { Avatar } from "./components/avatar.tsx";
import { ProfilesSyncer } from "../features/profile.ts";
import { DirectedMessage_Event, Text_Note_Event } from "../nostr.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { AboutIcon } from "./icons/about-icon.tsx";
import { PrimaryTextColor } from "./style/colors.ts";

interface MessageThreadProps {
    eventEmitter: EventEmitter<DirectMessagePanelUpdate | EditorEvent>;
    messages: ChatMessage[];
    myPublicKey: PublicKey;
    db: Database_Contextual_View;
    editorModel: EditorModel;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    allUserInfo: Map<string, UserInfo>;
}

export function MessageThreadPanel(props: MessageThreadProps) {
    return (
        <Fragment>
            <div
                class={tw`h-12 min-h-[3rem] flex items-center px-2 bg-[#42464D] justify-between`}
            >
                <span class={tw`whitespace-nowrap truncate`}>
                    <span class={tw`text-[#F3F4EA]`}>
                        Thread
                    </span>
                </span>
            </div>

            <div class={tw`h-fit mb-4`}>
                <MessageThreadList
                    myPublicKey={props.myPublicKey}
                    messages={props.messages}
                    db={props.db}
                    profilesSyncer={props.profilesSyncer}
                    eventSyncer={props.eventSyncer}
                    eventEmitter={props.eventEmitter}
                    allUserInfo={props.allUserInfo}
                />
            </div>

            <Editor
                model={props.editorModel}
                placeholder={"Reply to thread"}
                maxHeight="30vh"
                eventEmitter={props.eventEmitter}
            />
        </Fragment>
    );
}

function MessageThreadList(props: {
    myPublicKey: PublicKey;
    messages: ChatMessage[];
    db: Database_Contextual_View;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    eventEmitter: EventEmitter<ViewUserDetail | ViewThread | DirectMessagePanelUpdate>;
    allUserInfo: Map<string, UserInfo>;
}) {
    let groups = groupContinuousMessages(props.messages, (pre, cur) => {
        const sameAuthor = pre.event.pubkey == cur.event.pubkey;
        const _66sec = Math.abs(cur.created_at.getTime() - pre.created_at.getTime()) < 1000 * 60;
        return sameAuthor && _66sec;
    });
    let groupNodes = [];
    for (let group of groups) {
        groupNodes.push(
            <MessageThreadBoxGroup
                messages={group}
                myPublicKey={props.myPublicKey}
                db={props.db}
                profilesSyncer={props.profilesSyncer}
                eventSyncer={props.eventSyncer}
                eventEmitter={props.eventEmitter}
                allUserInfo={props.allUserInfo}
            />,
        );
    }
    return (
        <ul
            class={tw`w-full h-full overflow-y-auto overflow-x-hidden pb-4 px-2 flex flex-col`}
        >
            {groupNodes}
        </ul>
    );
}

function MessageThreadBoxGroup(props: {
    messages: ChatMessage[];
    myPublicKey: PublicKey;
    db: Database_Contextual_View;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    eventEmitter: EventEmitter<ViewUserDetail | ViewThread | DirectMessagePanelUpdate>;
    allUserInfo: Map<string, UserInfo>;
}) {
    const first_group = props.messages[0];
    const rows = [];
    rows.push(
        <li
            class={tw`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group relative`}
        >
            {MessageThreadActions(first_group.event, props.eventEmitter.emit)}
            <Avatar
                class={tw`h-8 w-8 mt-[0.45rem] mr-2`}
                picture={getUserInfoFromPublicKey(first_group.event.publicKey, props.allUserInfo)
                    ?.profile?.profile.picture}
                onClick={() => {
                    props.eventEmitter.emit({
                        type: "ViewUserDetail",
                        pubkey: first_group.event.publicKey,
                    });
                }}
            />
            <div
                class={tw`flex-1`}
                style={{
                    maxWidth: "calc(100% - 2.75rem)",
                }}
            >
                {NameAndTime(
                    first_group.event.publicKey,
                    getUserInfoFromPublicKey(first_group.event.publicKey, props.allUserInfo)
                        ?.profile?.profile,
                    props.myPublicKey,
                    first_group.created_at,
                )}
                <pre
                    class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                >
                    {ParseMessageContent(first_group, props.allUserInfo, props.profilesSyncer, props.eventSyncer, props.eventEmitter)}
                </pre>
            </div>
        </li>,
    );

    for (let i = 1; i < props.messages.length; i++) {
        const msg = props.messages[i];
        rows.push(
            <li
                class={tw`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group relative`}
            >
                {MessageThreadActions(msg.event, props.eventEmitter.emit)}
                {Time(msg.created_at)}
                <div
                    class={tw`flex-1`}
                    style={{
                        maxWidth: "calc(100% - 2.75rem)",
                    }}
                >
                    {NameAndTime(
                        msg.event.publicKey,
                        getUserInfoFromPublicKey(msg.event.publicKey, props.allUserInfo)
                            ?.profile?.profile,
                        props.myPublicKey,
                        msg.created_at,
                    )}
                    <pre
                        class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                    >
                    {ParseMessageContent(msg, props.allUserInfo, props.profilesSyncer, props.eventSyncer, props.eventEmitter)}
                    </pre>
                </div>
            </li>,
        );
    }

    const vnode = (
        <ul class={tw`pt-4 pb-2`}>
            {rows}
        </ul>
    );

    // console.log("MessageBoxGroup", Date.now() - t)
    return vnode;
}

export function MessageThreadActions(
    event: Text_Note_Event | DirectedMessage_Event,
    emit: emitFunc<{ type: "ViewEventDetail"; event: Text_Note_Event | DirectedMessage_Event }>,
) {
    return (
        <ButtonGroup
            class={tw`hidden group-hover:flex absolute top-[-0.75rem] right-[3rem]`}
            style={{
                boxShadow: "2px 2px 5px 0 black",
            }}
        >
            <button
                class={tw`w-6 h-6 flex items-center justify-center`}
                onClick={async () => {
                    emit({
                        type: "ViewEventDetail",
                        event: event,
                    });
                }}
            >
                <AboutIcon
                    class={tw`w-4 h-4 scale-150`}
                    style={{
                        fill: PrimaryTextColor,
                    }}
                />
            </button>
        </ButtonGroup>
    );
}
