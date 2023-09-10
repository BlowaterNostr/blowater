/** @jsx h */
import { Component, ComponentChildren, createRef, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Editor, EditorEvent, EditorModel } from "./editor.tsx";

import { AboutIcon, CloseIcon, LeftArrowIcon, ReplyIcon } from "./icons/mod.tsx";
import { Avatar } from "./components/avatar.tsx";
import { DividerClass, IconButtonClass } from "./components/tw.ts";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { emitFunc, EventEmitter } from "../event-bus.ts";

import { ChatMessage, groupContinuousMessages, sortMessage, urlIsImage } from "./message.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import {
    CustomAppData_Event,
    PinContact,
    PlainText_Nostr_Event,
    Profile_Nostr_Event,
    UnpinContact,
} from "../nostr.ts";
import { ProfileData, ProfilesSyncer } from "../features/profile.ts";
import { MessageThread } from "./dm.tsx";
import { UserDetail } from "./user-detail.tsx";
import { MessageThreadPanel } from "./message-thread-panel.tsx";
import { Database_Contextual_View } from "../database.ts";
import { HoverButtonBackgroudColor, LinkColor, PrimaryTextColor } from "./style/colors.ts";
import { getUserInfoFromPublicKey, UserInfo } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { NoteID } from "../lib/nostr-ts/nip19.ts";

export type RightPanelModel = {
    show: boolean;
};

export type DirectMessagePanelUpdate =
    | {
        type: "ToggleRightPanel";
        show: boolean;
    }
    | ViewThread
    | ViewUserDetail
    | {
        type: "ViewEventDetail";
        event: PlainText_Nostr_Event;
    };

export type ViewThread = {
    type: "ViewThread";
    root: NostrEvent;
};

export type ViewUserDetail = {
    type: "ViewUserDetail";
    pubkey: PublicKey;
};

interface DirectMessagePanelProps {
    myPublicKey: PublicKey;
    editorModel: EditorModel;

    messages: MessageThread[];
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

    db: Database_Contextual_View;
    eventEmitter: EventEmitter<
        EditorEvent | DirectMessagePanelUpdate | PinContact | UnpinContact
    >;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    allUserInfo: Map<string, UserInfo>;
}

export function MessagePanel(props: DirectMessagePanelProps) {
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
                        myPublicKey={props.myPublicKey}
                        db={props.db}
                        editorModel={props.focusedContent.editor}
                        profilesSyncer={props.profilesSyncer}
                        eventSyncer={props.eventSyncer}
                        allUserInfo={props.allUserInfo}
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
    let vnode = (
        <div class={tw`flex h-full w-full relative`}>
            <div class={tw`flex flex-col h-full flex-1 overflow-hidden`}>
                <div class={tw`flex-1`}></div>
                {
                    <MessageList
                        myPublicKey={props.myPublicKey}
                        threads={props.messages}
                        eventEmitter={props.eventEmitter}
                        db={props.db}
                        profilesSyncer={props.profilesSyncer}
                        eventSyncer={props.eventSyncer}
                        allUserInfo={props.allUserInfo}
                    />
                }
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
    myPublicKey: PublicKey;
    threads: MessageThread[];
    db: Database_Contextual_View;
    eventEmitter: EventEmitter<DirectMessagePanelUpdate>;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    allUserInfo: Map<string, UserInfo>;
}

interface MessageListState {
    currentRenderCount: number;
}

const ItemsOfPerPage = 100;
export class MessageList extends Component<MessageListProps, MessageListState> {
    constructor(public props: MessageListProps) {
        super();
    }
    messagesULElement = createRef<HTMLUListElement>();
    state = {
        currentRenderCount: ItemsOfPerPage,
    };
    jitter = new JitterPrevention(100);

    componentWillReceiveProps() {
        this.setState({
            currentRenderCount: ItemsOfPerPage,
        });
    }

    onScroll = async (e: h.JSX.TargetedUIEvent<HTMLUListElement>) => {
        if (
            e.currentTarget.scrollHeight - e.currentTarget.offsetHeight +
                    e.currentTarget.scrollTop < 1000
        ) {
            const ok = await this.jitter.shouldExecute();
            if (!ok || this.state.currentRenderCount >= this.props.threads.length) {
                return;
            }
            this.setState({
                currentRenderCount: Math.min(
                    this.state.currentRenderCount + ItemsOfPerPage,
                    this.props.threads.length,
                ),
            });
        }
    };

    sortAndSliceMessage = () => {
        return sortMessage(this.props.threads)
            .slice(
                0,
                this.state.currentRenderCount,
            );
    };

    render() {
        const t = Date.now();
        const groups = groupContinuousMessages(this.sortAndSliceMessage(), (pre, cur) => {
            const sameAuthor = pre.root.event.pubkey == cur.root.event.pubkey;
            const _66sec =
                Math.abs(cur.root.created_at.getTime() - pre.root.created_at.getTime()) < 1000 * 60;
            return sameAuthor && _66sec;
        });
        console.log("MessageList:groupContinuousMessages", Date.now() - t);
        const messageBoxGroups = [];
        let i = 0;
        for (const threads of groups) {
            messageBoxGroups.push(
                MessageBoxGroup({
                    messageGroup: threads.map((thread) => {
                        i++;
                        return {
                            msg: thread.root,
                            replyCount: thread.replies.length,
                        };
                    }),
                    myPublicKey: this.props.myPublicKey,
                    eventEmitter: this.props.eventEmitter,
                    db: this.props.db,
                    profilesSyncer: this.props.profilesSyncer,
                    eventSyncer: this.props.eventSyncer,
                    allUserInfo: this.props.allUserInfo,
                }),
            );
        }
        console.log(`MessageList:elements ${i}`, Date.now() - t);

        const vNode = (
            <div
                class={tw`w-full overflow-hidden`}
                style={{
                    transform: "perspective(none)",
                }}
            >
                <button
                    onClick={() => {
                        if (this.messagesULElement.current) {
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
                </button>
                <ul
                    class={tw`w-full h-full overflow-y-auto overflow-x-hidden py-8 px-2 flex flex-col-reverse`}
                    ref={this.messagesULElement}
                    onScroll={this.onScroll}
                >
                    {messageBoxGroups}
                </ul>
            </div>
        );
        console.log("MessageList:end", Date.now() - t);
        return vNode;
    }
}

function MessageBoxGroup(props: {
    messageGroup: {
        msg: ChatMessage;
        replyCount: number;
    }[];
    myPublicKey: PublicKey;
    db: Database_Contextual_View;
    allUserInfo: Map<string, UserInfo>;
    eventEmitter: EventEmitter<DirectMessagePanelUpdate | ViewUserDetail>;
    profilesSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
}) {
    // const t = Date.now();

    const messageGroups = props.messageGroup.reverse();
    if (messageGroups.length == 0) {
        return;
    }
    const first_group = messageGroups[0];
    const rows = [];
    rows.push(
        <li
            class={tw`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group relative`}
        >
            {MessageActions(first_group.msg.event, props.eventEmitter.emit)}
            <Avatar
                class={tw`h-8 w-8 mt-[0.45rem] mr-2`}
                picture={getUserInfoFromPublicKey(first_group.msg.event.publicKey, props.allUserInfo)
                    ?.profile?.profile.picture}
                onClick={() => {
                    props.eventEmitter.emit({
                        type: "ViewUserDetail",
                        pubkey: first_group.msg.event.publicKey,
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
                    first_group.msg.event.publicKey,
                    getUserInfoFromPublicKey(first_group.msg.event.publicKey, props.allUserInfo)
                        ?.profile?.profile,
                    0,
                    props.myPublicKey,
                    first_group.msg.created_at,
                )}
                <pre
                    class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                >
                                {ParseMessageContent(
                                    first_group.msg,
                                    props.allUserInfo,
                                    props.profilesSyncer,
                                    props.eventSyncer,
                                    props.eventEmitter,
                                    )}
                </pre>
                {first_group.replyCount > 0
                    ? (
                        <div class={tw`flex items-center mb-[0.45rem] ml-[1rem]`}>
                            <span
                                class={tw`text-[#A6A8AA] font-bold hover:underline cursor-pointer text-[0.8rem]`}
                                onClick={() => {
                                    props.eventEmitter.emit({
                                        type: "ViewThread",
                                        root: first_group.msg.event,
                                    });
                                }}
                            >
                                {first_group.replyCount} replies
                            </span>
                        </div>
                    )
                    : undefined}
            </div>
        </li>,
    );

    for (let i = 1; i < messageGroups.length; i++) {
        const msg = messageGroups[i];
        rows.push(
            <li
                class={tw`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 group relative`}
            >
                {MessageActions(msg.msg.event, props.eventEmitter.emit)}
                {Time(msg.msg.created_at)}
                <div
                    class={tw`flex-1`}
                    style={{
                        maxWidth: "calc(100% - 2.75rem)",
                    }}
                >
                    {NameAndTime(
                        msg.msg.event.publicKey,
                        getUserInfoFromPublicKey(msg.msg.event.publicKey, props.allUserInfo)
                            ?.profile?.profile,
                        i,
                        props.myPublicKey,
                        msg.msg.created_at,
                    )}
                    <pre
                        class={tw`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                    >
                    {ParseMessageContent(
                        msg.msg,
                        props.allUserInfo,
                        props.profilesSyncer,
                        props.eventSyncer,
                        props.eventEmitter,
                        )}
                    </pre>
                    {msg.replyCount > 0
                        ? (
                            <div class={tw`flex items-center mb-[0.45rem] ml-[1rem]`}>
                                <span
                                    class={tw`text-[#A6A8AA] font-bold hover:underline cursor-pointer text-[0.8rem]`}
                                    onClick={() => {
                                        props.eventEmitter.emit({
                                            type: "ViewThread",
                                            root: msg.msg.event,
                                        });
                                    }}
                                >
                                    {msg.replyCount} replies
                                </span>
                            </div>
                        )
                        : undefined}
                </div>
            </li>,
        );
    }

    const vnode = (
        <ul class={tw`py-2`}>
            {rows}
        </ul>
    );

    // console.log("MessageBoxGroup", Date.now() - t);
    return vnode;
}

function MessageActions(
    event: PlainText_Nostr_Event,
    emit: emitFunc<ViewThread | DirectMessagePanelUpdate>,
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
                onClick={() => {
                    emit({
                        type: "ViewThread",
                        root: event,
                    });
                }}
            >
                <ReplyIcon
                    class={tw`w-4 h-4 scale-150`}
                    style={{
                        fill: PrimaryTextColor,
                    }}
                />
            </button>

            <button
                class={tw`w-6 h-6 flex items-center justify-center`}
                onClick={async () => {
                    const eventID = event.id;
                    const eventIDBech32 = NoteID.FromString(event.id).bech32();
                    const authorPubkey = event.publicKey.hex;
                    const authorPubkeyBech32 = event.publicKey.bech32();
                    const content = event.content;
                    const originalEventRaw = JSON.stringify(
                        {
                            content: event.content,
                            created_at: event.created_at,
                            kind: event.kind,
                            tags: event.tags,
                            pubkey: event.pubkey,
                            id: event.id,
                            sig: event.sig,
                        },
                        null,
                        4,
                    );

                    const items: EventDetailItem[] = [
                        {
                            title: "Event ID",
                            fields: [
                                eventID,
                                eventIDBech32,
                            ],
                        },
                        {
                            title: "Author",
                            fields: [
                                authorPubkey,
                                authorPubkeyBech32,
                            ],
                        },
                        {
                            title: "Content",
                            fields: [
                                content,
                                originalEventRaw,
                            ],
                        },
                    ];

                    emit({
                        type: "ViewEventDetail",
                        event: event,
                    });
                    // await PopoverChan.put(
                    //     {
                    //         children: <EventDetail items={items} />,
                    //     },
                    // );
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

export function Time(created_at: Date) {
    return (
        <div class={tw`w-8 mr-2`}>
            <span
                class={tw`text-[#A3A6AA] text-[0.8rem] hidden group-hover:inline-block`}
            >
                {created_at.toTimeString().slice(0, 5)}
            </span>
        </div>
    );
}

export function NameAndTime(
    author: PublicKey,
    author_profile: ProfileData | undefined,
    index: number,
    myPublicKey: PublicKey,
    created_at: Date,
) {
    if (index === 0) {
        let show = author.bech32();
        if (author.hex == myPublicKey.hex) {
            show = "Me";
        } else if (author_profile?.name) {
            show = author_profile.name;
        }

        return (
            <p class={tw`overflow-hidden flex`}>
                <p class={tw`text-[#FFFFFF] text-[0.9rem] truncate`}>
                    {show}
                </p>
                <p class={tw`text-[#A3A6AA] ml-4 text-[0.8rem] whitespace-nowrap`}>
                    {created_at.toLocaleString()}
                </p>
            </p>
        );
    }
}

export function ParseMessageContent(
    message: ChatMessage,
    allUserInfo: Map<string, UserInfo>,
    profilesSyncer: ProfilesSyncer,
    eventSyncer: EventSyncer,
    eventEmitter: EventEmitter<ViewUserDetail | ViewThread>,
) {
    if (message.type == "image") {
        return <img src={message.content} />;
    }

    const vnode = [];
    let start = 0;
    for (const item of message.event.parsedContentItems) {
        vnode.push(message.content.slice(start, item.start));
        const itemStr = message.content.slice(item.start, item.end + 1);
        switch (item.type) {
            case "url":
                {
                    if (urlIsImage(itemStr)) {
                        vnode.push(<img src={itemStr} />);
                    } else {
                        vnode.push(
                            <a target="_blank" class={tw`hover:underline text-[${LinkColor}]`} href={itemStr}>
                                {itemStr}
                            </a>,
                        );
                    }
                }
                break;
            case "npub":
                {
                    const userInfo = allUserInfo.get(item.pubkey);
                    if (userInfo) {
                        const profile = userInfo.profile;
                        if (profile) {
                            vnode.push(
                                ProfileCard(
                                    profile.profile,
                                    PublicKey.FromHex(item.pubkey) as PublicKey,
                                    eventEmitter,
                                ),
                            );
                            break;
                        } else {
                            profilesSyncer.add(item.pubkey);
                        }
                    } else {
                        profilesSyncer.add(item.pubkey);
                    }
                    vnode.push(
                        ProfileCard(
                            undefined,
                            PublicKey.FromHex(item.pubkey) as PublicKey,
                            eventEmitter,
                        ),
                    );
                }
                break;
            case "note":
                {
                    const event = eventSyncer.syncEvent(item.noteID);
                    if (event instanceof Promise) {
                        break;
                    }
                    vnode.push(NoteCard(event, eventEmitter, allUserInfo));
                }
                break;
            case "tag":
                // todo
                break;
        }

        start = item.end + 1;
    }
    vnode.push(message.content.slice(start));

    return vnode;
}

function ProfileCard(
    profile: ProfileData | undefined,
    pubkey: PublicKey,
    eventEmitter: EventEmitter<ViewUserDetail>,
) {
    return (
        <div
            class={tw`px-4 py-2 my-1 border-2 border-[${PrimaryTextColor}4D] rounded-lg hover:bg-[${HoverButtonBackgroudColor}] cursor-pointer py-1`}
            onClick={() => {
                eventEmitter.emit({
                    type: "ViewUserDetail",
                    pubkey: pubkey,
                });
            }}
        >
            <div class={tw`flex`}>
                <Avatar class={tw`w-10 h-10`} picture={profile?.picture}></Avatar>
                <p class={tw`text-[1.2rem] font-blod leading-10 truncate ml-2`}>
                    {profile?.name || pubkey.bech32()}
                </p>
            </div>
            <div class={tw`${DividerClass} my-[0.5rem]`}></div>
            <p class={tw`text-[0.8rem]`}>{profile?.about}</p>
        </div>
    );
}

function NoteCard(
    event: Profile_Nostr_Event | PlainText_Nostr_Event | CustomAppData_Event,
    eventEmitter: EventEmitter<ViewThread | ViewUserDetail>,
    allUserInfo: Map<string, UserInfo>,
) {
    switch (event.kind) {
        case NostrKind.META_DATA:
            return ProfileCard(event.profile, event.publicKey, eventEmitter);
        case NostrKind.TEXT_NOTE:
        case NostrKind.DIRECT_MESSAGE:
            const profile = allUserInfo.get(event.pubkey)?.profile;
            return (
                <div class={tw`px-4 my-1 py-2 border-2 border-[${PrimaryTextColor}4D] rounded-lg py-1 flex`}>
                    <Avatar class={tw`w-10 h-10`} picture={profile?.profile.picture} />
                    <div class={tw`ml-2 flex-1 overflow-hidden`}>
                        <p class={tw`truncate`}>{profile?.profile.name || event.publicKey.bech32()}</p>
                        <p class={tw`text-[0.8rem]`}>{event.content}</p>
                    </div>
                </div>
            );
        default:
            return (
                <div class={tw`px-4 my-1 py-2 border-2 border-[${PrimaryTextColor}4D] rounded-lg py-1 flex`}>
                    {event.content}
                </div>
            );
    }
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
