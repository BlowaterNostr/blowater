/** @jsx h */
import { Component, ComponentChildren, createRef, Fragment, h, VNode } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Editor, EditorEvent, EditorModel } from "./editor.tsx";

import { CloseIcon, LeftArrowIcon, ReplyIcon } from "./icons/mod.tsx";
import { Avatar } from "./components/avatar.tsx";
import { DividerClass, IconButtonClass } from "./components/tw.ts";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { EventEmitter } from "../event-bus.ts";

import { ChatMessage_v2, groupContinuousMessages, parseContent, sortMessage, urlIsImage } from "./message.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    NostrAccountContext,
    NostrEvent,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PinContact, UnpinContact } from "../nostr.ts";
import { getProfileEvent, ProfileData } from "../features/profile.ts";
import { MessageThread } from "./dm.tsx";
import { UserDetail } from "./user-detail.tsx";
import { MessageThreadPanel } from "./message-thread-panel.tsx";
import { Database } from "../database.ts";
import {
    DividerBackgroundColor,
    HoverButtonBackgroudColor,
    LinkColor,
    PrimaryBackgroundColor,
    PrimaryTextColor,
} from "./style/colors.ts";
import { ProfilesSyncer, UserInfo } from "./contact-list.ts";
import { NoteID } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nip19.ts";
import { EventSyncer } from "./event_syncer.ts";
import { getConversationMessages } from "./app_update.ts";

interface DirectMessagePanelProps {
    ctx: NostrAccountContext;
    editorModel: EditorModel;

    messages: MessageThread[];
    // events: NostrEvent[]
    focusedContent: {
        type: "MessageThread";
        data: MessageThread;
        editor: EditorModel;
    } | {
        type: "ProfileData";
        data?: ProfileData;
        pubkey: PublicKey;
    } | undefined;

    rightPanelModel: RightPanelModel;

    db: Database;
    eventEmitter: EventEmitter<
        EditorEvent | DirectMessagePanelUpdate | PinContact | UnpinContact
    >;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
}

export type RightPanelModel = {
    show: boolean;
};

export type DirectMessagePanelUpdate =
    | {
        type: "ToggleRightPanel";
        show: boolean;
    }
    | ViewThread
    | ViewUserDetail;

export type ViewThread = {
    type: "ViewThread";
    root: NostrEvent;
};

export type ViewUserDetail = {
    type: "ViewUserDetail";
    pubkey: PublicKey;
};

export async function MessagePanel(props: DirectMessagePanelProps) {
    const t = Date.now();
    let placeholder = "Post your thoughts";
    if (props.editorModel.target.kind == NostrKind.DIRECT_MESSAGE) {
        placeholder = `Message @${
            props.editorModel.target.receiver.name || props.editorModel.target.receiver.pubkey.bech32()
        }`;
    }

    let rightPanel;
    if (props.rightPanelModel.show) {
        let rightPanelChildren: h.JSX.Element | undefined;
        if (props.focusedContent) {
            if (props.focusedContent.type == "MessageThread") {
                rightPanelChildren = (
                    <MessageThreadPanel
                        eventEmitter={props.eventEmitter}
                        messages={[props.focusedContent.data.root, ...props.focusedContent.data.replies]}
                        myPublicKey={props.ctx.publicKey}
                        db={props.db}
                        editorModel={props.focusedContent.editor}
                        profilesSyncer={props.profilesSyncer}
                        eventSyncer={props.eventSyncer}
                    />
                );
            } else if (props.focusedContent.type == "ProfileData") {
                rightPanelChildren = (
                    <UserDetail
                        targetUserProfile={{
                            name: props.focusedContent?.data?.name,
                            picture: props.focusedContent?.data?.picture,
                            about: props.focusedContent?.data?.about,
                            website: props.focusedContent?.data?.website,
                        }}
                        pubkey={props.focusedContent.pubkey}
                        eventEmitter={props.eventEmitter}
                    />
                );
            }
        }
        rightPanel = (
            <RightPanel
                eventEmitter={props.eventEmitter}
                rightPanelModel={props.rightPanelModel}
            >
                {rightPanelChildren}
            </RightPanel>
        );
    }
    const messageList = await MessageList({
        ctx: props.ctx,
        messages: props.messages,
        eventEmitter: props.eventEmitter,
        db: props.db,
        profilesSyncer: props.profilesSyncer,
        eventSyncer: props.eventSyncer,
    });
    console.log("------", messageList);
    if (messageList instanceof Error) {
        return messageList;
    }
    let vnode = (
        <div class={tw`flex h-full w-full relative`}>
            <div class={tw`flex flex-col h-full flex-1 overflow-hidden`}>
                <div class={tw`flex-1`}></div>
                {messageList}
                {
                    <Editor
                        model={props.editorModel}
                        placeholder={placeholder}
                        maxHeight="30vh"
                        eventEmitter={props.eventEmitter}
                    />
                }
            </div>
            {!props.rightPanelModel.show
                ? (
                    <button
                        class={tw`absolute z-10 w-6 h-6 transition-transform duration-100 ease-in-out right-4 top-4${
                            props.rightPanelModel.show ? " rotate-180" : ""
                        } ${IconButtonClass}`}
                        onClick={() => {
                            props.eventEmitter.emit({
                                type: "ToggleRightPanel",
                                show: !props.rightPanelModel.show,
                            });
                        }}
                    >
                        <LeftArrowIcon
                            class={tw`w-4 h-4`}
                            style={{
                                fill: "#F3F4EA",
                            }}
                        />
                    </button>
                )
                : undefined}
            {rightPanel}
        </div>
    );
    console.log("DirectMessagePanel:end", Date.now() - t);
    return vnode;
}

interface MessageListProps {
    ctx: NostrAccountContext;
    // allUserInfo: Map<string, UserInfo>
    messages: MessageThread[];
    db: Database;
    eventEmitter: EventEmitter<DirectMessagePanelUpdate>;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
}

interface MessageListState {
    currentRenderCount: number;
}

const ItemsOfPerPage = 100;
let currentRenderCount = ItemsOfPerPage;

class JitterPrevention {
    constructor(private duration: number) {}
    cancel: ((value: void) => void) | undefined;
    async shouldExecute(): Promise<boolean> {
        if (this.cancel) {
            this.cancel();
            this.cancel = undefined;
            return this.shouldExecute();
        }
        const p = new Promise<void>((resolve) => {
            this.cancel = resolve;
        });
        const cancelled = await sleep(this.duration, p);
        return !cancelled;
    }
}
const jitter = new JitterPrevention(100);
// export class MessageList_ extends Component<MessageListProps, MessageListState> {
//     constructor(public props: MessageListProps) {
//         super();
//     }
//     messagesULElement = createRef<HTMLUListElement>();
//     state = {
//         currentRenderCount: ItemsOfPerPage,
//     };

//     componentWillReceiveProps() {
//         this.setState({
//             currentRenderCount: ItemsOfPerPage,
//         });
//     }

// }

// const onScroll = async (e: h.JSX.TargetedUIEvent<HTMLUListElement>) => {
//     if (
//         e.currentTarget.scrollHeight - e.currentTarget.offsetHeight +
//                 e.currentTarget.scrollTop < 1000
//     ) {
//         const ok = await jitter.shouldExecute();
//         if (!ok || currentRenderCount >= props.messages.length) {
//             return;
//         }
//         this.setState({
//             currentRenderCount: Math.min(
//                 this.state.currentRenderCount + ItemsOfPerPage,
//                 this.props.messages.length,
//             ),
//         });
//     }
// };

async function MessageList(props: MessageListProps) {
    const t = Date.now();
    const groups = groupContinuousMessages(sortMessage(props.messages.slice(0, 75)), (pre, cur) => {
        const sameAuthor = pre.root.root_event.pubkey == cur.root.root_event.pubkey;
        const _66sec = Math.abs(cur.root.created_at.getTime() - pre.root.created_at.getTime()) < 1000 * 60;
        return sameAuthor && _66sec;
    });
    console.log("MessageList:groupContinuousMessages", Date.now() - t);
    const messageBoxGroups: h.JSX.Element[] = [];
    for (const threads of groups) {
        const boxGroup = await MessageBoxGroup({
            messageGroup: threads.map((thread) => {
                return {
                    msg: thread.root,
                    replyCount: thread.replies.length,
                };
            }),
            myPublicKey: props.ctx.publicKey,
            eventEmitter: props.eventEmitter,
            db: props.db,
            profilesSyncer: props.profilesSyncer,
            eventSyncer: props.eventSyncer,
        });
        if (boxGroup instanceof Error) {
            return boxGroup;
        }
        messageBoxGroups.push(
            boxGroup,
        );
    }
    console.log("MessageList:elements", Date.now() - t);

    const vNode = (
        <div
            class={tw`w-full overflow-hidden`}
            style={{
                transform: "perspective(none)",
            }}
        >
            {
                /* <button
                onClick={() => {
                    if (this.xmessagesULElement.current) {
                        this.messagesULElement.current.scrollTo({
                            top: this.messagesULElement.current.scrollHeight,
                            left: 0,
                            behavior: "smooth",
                        });
                    }
                }}
                class={tw`${IconButtonClass} fixed z-10 bottom-8 right-4 h-10 w-10 rotate-[-90deg] bg-[#42464D] hover:bg-[#2F3136]`}
            >
                <LeftArrowIcon
                    class={tw`w-6 h-6`}
                    style={{
                        fill: "#F3F4EA",
                    }}
                />
            </button> */
            }
            <ul
                class={tw`w-full h-full overflow-y-auto overflow-x-hidden py-8 px-2 flex flex-col-reverse`}
                // ref={this.messagesULElement}
                // onScroll={this.onScroll}
            >
                {messageBoxGroups}
            </ul>
        </div>
    );
    console.log("MessageList:end", Date.now() - t);
    return vNode;
}

async function MessageBoxGroup(props: {
    messageGroup: {
        msg: ChatMessage_v2;
        replyCount: number;
    }[];
    myPublicKey: PublicKey;
    db: Database;
    eventEmitter: EventEmitter<DirectMessagePanelUpdate | ViewUserDetail>;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
}) {
    // const t = Date.now();
    const vNodes = [];
    let index = 0;
    for (const msg of props.messageGroup.reverse()) {
        const parsedContent = await ParseMessageContent(
            msg.msg,
            props.db,
            props.profilesSyncer,
            props.eventSyncer,
            props.eventEmitter,
        );
        if (parsedContent instanceof Error) {
            console.warn(parsedContent.message);
            continue;
        }
        const node = (
            <li
                class={tw`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group relative`}
            >
                <button
                    class={tw`w-6 h-6 absolute hidden group-hover:flex top-[-0.75rem] right-[3rem] ${IconButtonClass} bg-[#42464D] hover:bg-[#2F3136]`}
                    style={{
                        boxShadow: "2px 2px 5px 0 black",
                    }}
                    onClick={() => {
                        props.eventEmitter.emit({
                            type: "ViewThread",
                            root: msg.msg.root_event,
                        });
                    }}
                >
                    <ReplyIcon
                        class={tw`w-4 h-4`}
                        style={{
                            fill: "rgb(185, 187, 190)",
                        }}
                    />
                </button>

                {AvatarOrTime(msg.msg, index, props.eventEmitter)}
                <div
                    class={tw`flex-1`}
                    style={{
                        maxWidth: "calc(100% - 2.75rem)",
                    }}
                >
                    {NameAndTime(msg.msg, index, props.myPublicKey)}
                    <pre
                        class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                    >
                        {parsedContent}
                    </pre>
                    {msg.replyCount > 0
                        ? (
                            <div class={tw`flex items-center mb-[0.45rem] ml-[1rem]`}>
                                <span
                                    class={tw`text-[#A6A8AA] font-bold hover:underline cursor-pointer text-[0.8rem]`}
                                    onClick={() => {
                                        props.eventEmitter.emit({
                                            type: "ViewThread",
                                            root: msg.msg.root_event,
                                        });
                                    }}
                                >
                                    {msg.replyCount} replies
                                </span>
                            </div>
                        )
                        : undefined}
                </div>
            </li>
        );
        vNodes.push(node);
        index++;
    }
    const vnode = (
        <ul class={tw`py-2`}>
            {vNodes}
        </ul>
    );

    // console.log("MessageBoxGroup", Date.now() - t);
    return vnode;
}

export function AvatarOrTime(
    message: ChatMessage_v2,
    index: number,
    eventEmitter?: EventEmitter<ViewUserDetail>,
) {
    if (index === 0) {
        return (
            <Avatar
                class={tw`h-8 w-8 mt-[0.45rem] mr-2`}
                picture={message.author.picture}
                onClick={eventEmitter
                    ? () => {
                        eventEmitter.emit({
                            type: "ViewUserDetail",
                            pubkey: message.author.pubkey,
                        });
                    }
                    : undefined}
            />
        );
    }

    return (
        <div class={tw`w-8 mr-2`}>
            <span
                class={tw`text-[#A3A6AA] text-[0.8rem] hidden group-hover:inline-block`}
            >
                {message.created_at.toTimeString().slice(0, 5)}
            </span>
        </div>
    );
}

export function NameAndTime(message: ChatMessage_v2, index: number, myPublicKey: PublicKey) {
    if (index === 0) {
        return (
            <p class={tw`overflow-hidden flex`}>
                <p class={tw`text-[#FFFFFF] text-[0.9rem] truncate`}>
                    {message.author
                        ? (
                            message.author.pubkey.hex ===
                                    myPublicKey.hex
                                ? "Me"
                                : message.author.name ||
                                    message.author.pubkey.bech32()
                        )
                        : "no user meta"}
                </p>
                <p class={tw`text-[#A3A6AA] ml-4 text-[0.8rem] whitespace-nowrap`}>
                    {message.created_at.toLocaleString()}
                </p>
            </p>
        );
    }
}

export async function ParseMessageContent(
    message: ChatMessage_v2,
    db: Database,
    profilesSyncer: ProfilesSyncer,
    eventSyncer: EventSyncer,
    eventEmitter: EventEmitter<ViewUserDetail>,
) {
    const content = await message.content();
    if (content instanceof Error) {
        return content;
    }
    if (message.type == "image") {
        return <img src={content} />;
    }

    const vnode = [];
    let start = 0;
    for (const item of parseContent(content)) {
        const itemStr = content.slice(item.start, item.end + 1);
        vnode.push(content.slice(start, item.start));
        switch (item.type) {
            case "url":
                if (urlIsImage(itemStr)) {
                    vnode.push(<img src={itemStr} />);
                } else {
                    vnode.push(
                        <a target="_blank" class={tw`hover:underline text-[${LinkColor}]`} href={itemStr}>
                            {itemStr}
                        </a>,
                    );
                }
                break;
            case "npub":
                const pubkey = PublicKey.FromBech32(itemStr);
                if (pubkey instanceof Error) {
                    console.log("ParseMessageContent:", `${itemStr} is not valid pubkey`);
                    break;
                }
                const profile = getProfileEvent(db, pubkey);
                if (profile) {
                    vnode.push(ProfileCard(profile.content, pubkey, eventEmitter));
                } else {
                    profilesSyncer.add(pubkey.hex);
                }
                break;
            case "note":
                const note = NoteID.FromBech32(itemStr);
                if (note instanceof Error) {
                    console.error(note);
                    break;
                }
                const event = eventSyncer.syncEvent(note);
                if (event instanceof Promise) {
                    break;
                }
                vnode.push(NoteCard(event.content));
                break;
            case "tag":
                // todo
                break;
        }

        start = item.end + 1;
    }
    vnode.push(content.slice(start));

    return vnode;
}

function ProfileCard(profile: ProfileData, pubkey: PublicKey, eventEmitter: EventEmitter<ViewUserDetail>) {
    return (
        <div
            class={tw`px-4 py-2 border-2 border-[${PrimaryTextColor}4D] rounded-lg hover:bg-[${HoverButtonBackgroudColor}] cursor-pointer py-1`}
            onClick={() => {
                eventEmitter.emit({
                    type: "ViewUserDetail",
                    pubkey: pubkey,
                });
            }}
        >
            <div class={tw`flex`}>
                <Avatar class={tw`w-10 h-10`} picture={profile.picture}></Avatar>
                <p class={tw`text-[1.2rem] font-blod leading-10 truncate ml-2`}>
                    {profile.name || pubkey.bech32}
                </p>
            </div>
            <div class={tw`${DividerClass} my-[0.5rem]`}></div>
            <p class={tw`text-[0.8rem]`}>{profile.about}</p>
        </div>
    );
}

function NoteCard(content: string) {
    return (
        <div class={tw`px-4 py-2 border-2 border-[${PrimaryTextColor}4D] rounded-lg  py-1`}>
            {content}
        </div>
    );
}

type RightPanelProps = {
    eventEmitter: EventEmitter<DirectMessagePanelUpdate>;
    rightPanelModel: RightPanelModel;
    children: ComponentChildren;
};

function RightPanel(props: RightPanelProps) {
    return (
        <div
            class={tw`mobile:w-full desktop:w-96 bg-[#2F3136] overflow-hidden overflow-y-auto relative${
                props.rightPanelModel.show ? " block" : " hidden"
            }`}
        >
            <button
                class={tw`w-6 min-w-[1.5rem] h-6 ml-4 ${IconButtonClass} hover:bg-[#36393F] absolute right-2 top-3 z-10`}
                onClick={() => {
                    props.eventEmitter.emit({
                        type: "ToggleRightPanel",
                        show: false,
                    });
                }}
            >
                <CloseIcon
                    class={tw`w-4 h-4`}
                    style={{
                        stroke: "rgb(185, 187, 190)",
                    }}
                />
            </button>
            {props.children}
        </div>
    );
}
