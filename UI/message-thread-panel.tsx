/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { EventEmitter } from "../event-bus.ts";
import {
    Actions,
    DirectMessagePanelUpdate,
    NameAndTime,
    ParseMessageContent,
    ViewPlainTextEvent,
    ViewThread,
    ViewUserDetail,
} from "./message-panel.tsx";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { ChatMessage, groupContinuousMessages } from "./message.ts";
import { Editor, EditorEvent, EditorModel } from "./editor.tsx";
import { Database_Contextual_View } from "../database.ts";
import { getUserInfoFromPublicKey, ProfilesSyncer, UserInfo } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { Avatar } from "./components/avatar.tsx";

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
    eventEmitter: EventEmitter<ViewUserDetail | ViewThread | ViewPlainTextEvent>;
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
    eventEmitter: EventEmitter<ViewUserDetail | ViewThread | ViewPlainTextEvent>;
    allUserInfo: Map<string, UserInfo>;
}) {
    const vnode = (
        <ul class={tw`py-4`}>
            {props.messages.map((msg, index) => {
                return (
                    <li
                        class={tw`relative px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group`}
                    >
                        {Actions(msg.event, props.eventEmitter, true)}
                        {
                            <Avatar
                                class={tw`h-8 w-8 mt-[0.45rem] mr-2`}
                                picture={getUserInfoFromPublicKey(msg.event.publicKey, props.allUserInfo)
                                    ?.profile?.profile.picture}
                                onClick={() => {
                                    props.eventEmitter.emit({
                                        type: "ViewUserDetail",
                                        pubkey: msg.event.publicKey,
                                    });
                                }}
                            />
                        }
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
                                index,
                                props.myPublicKey,
                                msg.created_at,
                            )}
                            <pre
                                class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                            >
                                {ParseMessageContent(msg, props.allUserInfo, props.profilesSyncer, props.eventSyncer, props.eventEmitter)}
                            </pre>
                        </div>
                    </li>
                );
            })}
        </ul>
    );

    // console.log("MessageBoxGroup", Date.now() - t)
    return vnode;
}
