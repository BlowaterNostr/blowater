/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { EventEmitter } from "../event-bus.ts";
import {
    AvatarOrTime,
    DirectMessagePanelUpdate,
    NameAndTime,
    ParseMessageContent,
    ViewUserDetail,
} from "./message-panel.tsx";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { ChatMessage_v2, groupContinuousMessages } from "./message.ts";
import { Editor, EditorEvent, EditorModel } from "./editor.tsx";
import { Database } from "../database.ts";
import { ProfilesSyncer } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";

interface MessageThreadProps {
    eventEmitter: EventEmitter<DirectMessagePanelUpdate | EditorEvent>;
    messages: ChatMessage_v2[];
    myPublicKey: PublicKey;
    db: Database;
    editorModel: EditorModel;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
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
    messages: ChatMessage_v2[];
    db: Database;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    eventEmitter: EventEmitter<ViewUserDetail>;
}) {
    let groups = groupContinuousMessages(props.messages, (pre, cur) => {
        const sameAuthor = pre.root_event.pubkey == cur.root_event.pubkey;
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
    messages: ChatMessage_v2[];
    myPublicKey: PublicKey;
    db: Database;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    eventEmitter: EventEmitter<ViewUserDetail>;
}) {
    const vnode = (
        <ul class={tw`py-2`}>
            {props.messages.map((msg, index) => {
                const parsed = ParseMessageContent(msg, props.db, props.profilesSyncer, props.eventSyncer, props.eventEmitter)
                if(parsed instanceof Error) {
                    console.warn(parsed.message)
                    return undefined;
                }
                return (
                    <li class={tw`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group`}>
                        {AvatarOrTime(msg, index)}
                        <div
                            class={tw`flex-1`}
                            style={{
                                maxWidth: "calc(100% - 2.75rem)",
                            }}
                        >
                            {NameAndTime(msg, index, props.myPublicKey)}
                            <pre
                                class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                            >
                                {parsed}
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
