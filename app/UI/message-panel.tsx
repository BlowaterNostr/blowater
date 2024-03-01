/** @jsx h */
import { Component, createRef, h } from "https://esm.sh/preact@10.17.1";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { RelayRecordGetter } from "../database.ts";
import { emitFunc, EventSubscriber } from "../event-bus.ts";
import { ProfileData } from "../features/profile.ts";
import { Parsed_Event, PinConversation, UnpinConversation } from "../nostr.ts";
import { isMobile } from "./_helper.ts";
import { UI_Interaction_Event, UserBlocker } from "./app_update.tsx";
import { Avatar } from "./components/avatar.tsx";
import { IconButtonClass } from "./components/tw.ts";
import { Editor, EditorEvent, EditorModel } from "./editor.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { AboutIcon } from "./icons/about-icon.tsx";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";

import {
    ChatMessage,
    groupContinuousMessages,
    parseContent,
    sortMessage,
    urlIsImage,
    urlIsVideo,
} from "./message.ts";
import { NoteCard } from "./note-card.tsx";
import { ProfileCard } from "./profile-card.tsx";
import { RightPanel } from "./right-panel.tsx";
import { ProfileGetter } from "./search.tsx";
import { SelectConversation } from "./search_model.ts";
import { DividerBackgroundColor, ErrorColor, LinkColor, PrimaryTextColor } from "./style/colors.ts";
import { BlockUser, UnblockUser, UserDetail } from "./user-detail.tsx";

export type DirectMessagePanelUpdate =
    | ToggleRightPanel
    | ViewThread
    | ViewUserDetail
    | OpenNote
    | {
        type: "ViewEventDetail";
        message: ChatMessage;
    };

export type ToggleRightPanel = {
    type: "ToggleRightPanel";
    show: boolean;
};

export type OpenNote = {
    type: "OpenNote";
    event: NostrEvent;
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
    kind: NostrKind;

    focusedContent: {
        type: "ProfileData";
        data?: ProfileData;
        pubkey: PublicKey;
    } | undefined;

    emit: emitFunc<
        | EditorEvent
        | DirectMessagePanelUpdate
        | PinConversation
        | UnpinConversation
        | SelectConversation
        | BlockUser
        | UnblockUser
    >;
    eventSub: EventSubscriber<UI_Interaction_Event>;
    eventSyncer: EventSyncer;
    profileGetter: ProfileGetter;
    messages: ChatMessage[];
    relayRecordGetter: RelayRecordGetter;
    userBlocker: UserBlocker;
}

export class MessagePanel extends Component<DirectMessagePanelProps> {
    render(props: DirectMessagePanelProps) {
        let rightPanelChildren: h.JSX.Element | undefined;
        if (props.focusedContent) {
            if (props.focusedContent.type == "ProfileData") {
                rightPanelChildren = (
                    <UserDetail
                        targetUserProfile={{
                            name: props.focusedContent?.data?.name,
                            picture: props.focusedContent?.data?.picture,
                            about: props.focusedContent?.data?.about,
                            website: props.focusedContent?.data?.website,
                        }}
                        pubkey={props.focusedContent.pubkey}
                        emit={props.emit}
                        blocked={props.userBlocker.isUserBlocked(props.focusedContent.pubkey)}
                    />
                );
            }
        }
        let rightPanel = (
            <RightPanel
                emit={props.emit}
                eventSub={props.eventSub}
            >
                {rightPanelChildren}
            </RightPanel>
        );

        let vnode = (
            <div class={`flex h-full w-full relative bg-[#36393F]`}>
                <div class={`flex flex-col h-full flex-1 overflow-hidden`}>
                    <div class={`flex-1`}></div>

                    <MessageList
                        myPublicKey={props.myPublicKey}
                        messages={props.messages}
                        emit={props.emit}
                        eventSyncer={props.eventSyncer}
                        profileGetter={props.profileGetter}
                        relayRecordGetter={props.relayRecordGetter}
                    />

                    <Editor
                        maxHeight="30vh"
                        emit={props.emit}
                        targetNpub={props.editorModel.pubkey}
                        text={props.editorModel.text}
                        files={props.editorModel.files}
                        kind={props.kind}
                        placeholder=""
                    />
                </div>
                {rightPanel}
            </div>
        );
        return vnode;
    }
}
interface MessageListProps {
    myPublicKey: PublicKey;
    messages: ChatMessage[];
    emit: emitFunc<DirectMessagePanelUpdate | SelectConversation>;
    eventSyncer: EventSyncer;
    profileGetter: ProfileGetter;
    relayRecordGetter: RelayRecordGetter;
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
            if (!ok || this.state.currentRenderCount >= this.props.messages.length) {
                return;
            }
            this.setState({
                currentRenderCount: Math.min(
                    this.state.currentRenderCount + ItemsOfPerPage,
                    this.props.messages.length,
                ),
            });
        }
    };

    sortAndSliceMessage = () => {
        return sortMessage(this.props.messages)
            .slice(
                0,
                this.state.currentRenderCount,
            );
    };

    render() {
        const t = Date.now();
        const groups = groupContinuousMessages(this.sortAndSliceMessage(), (pre, cur) => {
            const sameAuthor = pre.event.pubkey == cur.event.pubkey;
            const _66sec = Math.abs(cur.created_at.getTime() - pre.created_at.getTime()) < 1000 * 60;
            return sameAuthor && _66sec;
        });
        const messageBoxGroups = [];
        for (const messages of groups) {
            const profileEvent = this.props.profileGetter.getProfilesByPublicKey(messages[0].author);
            messageBoxGroups.push(
                MessageBoxGroup({
                    messages: messages,
                    myPublicKey: this.props.myPublicKey,
                    emit: this.props.emit,
                    eventSyncer: this.props.eventSyncer,
                    authorProfile: profileEvent ? profileEvent.profile : undefined,
                    profileGetter: this.props.profileGetter,
                    relayRecordGetter: this.props.relayRecordGetter,
                }),
            );
        }

        const vNode = (
            <div
                class={`w-full overflow-hidden`}
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
                    class={`${IconButtonClass} mobile:hidden fixed z-10 bottom-8 right-4 h-10 w-10 rotate-[-90deg] bg-[#42464D] hover:bg-[#2F3136]`}
                >
                    <LeftArrowIcon
                        class={`w-6 h-6`}
                        style={{
                            fill: "#F3F4EA",
                        }}
                    />
                </button>
                <ul
                    class={`w-full h-full overflow-y-auto overflow-x-hidden py-9 mobile:py-2 px-2 mobile:px-0 flex flex-col-reverse`}
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
    authorProfile: ProfileData | undefined;
    messages: ChatMessage[];
    myPublicKey: PublicKey;
    emit: emitFunc<DirectMessagePanelUpdate | ViewUserDetail | SelectConversation>;
    eventSyncer: EventSyncer;
    profileGetter: ProfileGetter;
    relayRecordGetter: RelayRecordGetter;
}) {
    const messageGroups = props.messages.reverse();
    if (messageGroups.length == 0) {
        return;
    }
    const first_group = messageGroups[0];
    const rows = [];
    rows.push(
        <li
            class={`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 mobile:pr-4 group relative ${
                isMobile() ? "select-none" : ""
            }`}
        >
            {MessageActions(first_group, props.emit)}
            <Avatar
                class={`h-8 w-8 mt-[0.45rem] mr-2`}
                picture={props.authorProfile?.picture}
                onClick={() => {
                    props.emit({
                        type: "ViewUserDetail",
                        pubkey: first_group.author,
                    });
                }}
            />

            <div
                class={`flex-1`}
                style={{
                    maxWidth: "calc(100% - 2.75rem)",
                }}
            >
                {NameAndTime(
                    first_group.author,
                    props.authorProfile,
                    props.myPublicKey,
                    first_group.created_at,
                )}
                <pre
                    class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto text-sm`}
                >
                    {ParseMessageContent(
                        first_group,
                        props.authorProfile,
                        props.eventSyncer,
                        props.emit,
                        props.profileGetter,
                        )}
                </pre>
            </div>
        </li>,
    );

    for (let i = 1; i < messageGroups.length; i++) {
        const msg = messageGroups[i];
        rows.push(
            <li
                class={`px-4 hover:bg-[#32353B] w-full max-w-full flex items-center pr-8 mobile:pr-4 group relative text-sm ${
                    isMobile() ? "select-none" : ""
                }`}
            >
                {MessageActions(msg, props.emit)}
                {Time(msg.created_at)}
                <div
                    class={`flex-1`}
                    style={{
                        maxWidth: "calc(100% - 2.75rem)",
                    }}
                >
                    <pre
                        class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                    >
                    {ParseMessageContent(
                        msg,
                        props.authorProfile,
                        props.eventSyncer,
                        props.emit,
                        props.profileGetter
                        )}
                    </pre>
                </div>
            </li>,
        );
    }

    const vnode = (
        <ul class={`py-2`}>
            {rows}
        </ul>
    );

    // console.log("MessageBoxGroup", Date.now() - t);
    return vnode;
}

function MessageActions(
    message: ChatMessage,
    emit: emitFunc<ViewThread | DirectMessagePanelUpdate>,
) {
    return (
        <div
            class={`hidden group-hover:flex absolute top-[-0.75rem] right-[3rem]`}
            style={{
                boxShadow: "2px 2px 5px 0 black",
            }}
        >
            <button
                class={`w-6 h-6 flex items-center justify-center`}
                onClick={async () => {
                    emit({
                        type: "ViewEventDetail",
                        message: message,
                    });
                }}
            >
                <AboutIcon
                    class={`w-4 h-4 scale-150`}
                    style={{
                        fill: PrimaryTextColor,
                    }}
                />
            </button>
        </div>
    );
}

export function Time(created_at: Date) {
    return (
        <div class={`w-8 mr-2`}>
            <span
                class={`text-[#A3A6AA] text-xs hidden group-hover:inline-block`}
            >
                {created_at.toTimeString().slice(0, 5)}
            </span>
        </div>
    );
}

export function NameAndTime(
    author: PublicKey,
    author_profile: ProfileData | undefined,
    myPublicKey: PublicKey,
    created_at: Date,
) {
    let show = author.bech32();
    if (author.hex == myPublicKey.hex) {
        show = "Me";
    } else if (author_profile?.name) {
        show = author_profile.name;
    }

    return (
        <p class={`overflow-hidden flex`}>
            <p class={`text-[#FFFFFF] text-[0.9rem] truncate mobile:hidden`}>
                {show}
            </p>
            <p class={`text-[#A3A6AA] ml-4 text-[0.8rem] whitespace-nowrap mobile:ml-0 mobile:text-xs`}>
                {created_at.toLocaleString()}
            </p>
        </p>
    );
}

export function ParseMessageContent(
    message: ChatMessage,
    authorProfile: ProfileData | undefined,
    eventSyncer: EventSyncer,
    emit: emitFunc<ViewUserDetail | ViewThread | OpenNote | SelectConversation>,
    profileGetter: ProfileGetter,
) {
    if (message.type == "image") {
        return (
            <img
                class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                src={message.content}
            />
        );
    }

    const parsedContentItems = parseContent(message.content);

    const vnode = [];
    let start = 0;
    for (const item of parsedContentItems) {
        vnode.push(message.content.slice(start, item.start));
        const itemStr = message.content.slice(item.start, item.end + 1);
        switch (item.type) {
            case "url":
                {
                    if (urlIsImage(itemStr)) {
                        vnode.push(
                            <img
                                class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                                src={itemStr}
                            />,
                        );
                    } else if (urlIsVideo(itemStr)) {
                        vnode.push(
                            <video
                                class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                                controls
                                src={itemStr}
                            >
                            </video>,
                        );
                    } else {
                        vnode.push(
                            <a target="_blank" class={`hover:underline text-[${LinkColor}]`} href={itemStr}>
                                {itemStr}
                            </a>,
                        );
                    }
                }
                break;
            case "npub":
                {
                    if (authorProfile) {
                        const profile = profileGetter.getProfilesByPublicKey(item.pubkey);
                        vnode.push(
                            <ProfileCard
                                profileData={profile ? profile.profile : undefined}
                                publicKey={item.pubkey}
                                emit={emit}
                            />,
                        );
                        break;
                    } else {
                        // profilesSyncer.add(item.pubkey.hex);
                        // todo: what to do?
                        // maybe signal an event to the bus
                        // or maybe it's not necessary because now we
                        // are syncing all kind 0s
                    }
                    vnode.push(
                        <ProfileCard publicKey={item.pubkey} emit={emit} />,
                    );
                }
                break;
            case "note":
                {
                    const event = eventSyncer.syncEvent(item.noteID);
                    if (
                        event instanceof Promise || event.kind == NostrKind.DIRECT_MESSAGE
                    ) {
                        vnode.push(itemStr);
                        break;
                    }
                    const profile = profileGetter.getProfilesByPublicKey(event.publicKey);
                    vnode.push(Card(event, profile?.profile, emit, event.publicKey));
                }
                break;
            case "nevent": {
                const event = eventSyncer.syncEvent(NoteID.FromString(item.event.pointer.id));
                if (
                    event instanceof Promise || event.kind == NostrKind.DIRECT_MESSAGE
                ) {
                    vnode.push(itemStr);
                    break;
                }
                const profile = profileGetter.getProfilesByPublicKey(event.publicKey);
                vnode.push(Card(event, profile ? profile.profile : undefined, emit, event.publicKey));
            }
            case "tag":
                // todo
                break;
        }

        start = item.end + 1;
    }
    vnode.push(message.content.slice(start));

    return vnode;
}

function Card(
    event: Parsed_Event,
    authorProfile: ProfileData | undefined,
    emit: emitFunc<ViewThread | ViewUserDetail | OpenNote>,
    publicKey: PublicKey,
) {
    switch (event.kind) {
        case NostrKind.META_DATA:
            return <ProfileCard emit={emit} publicKey={event.publicKey} profileData={authorProfile} />;
        case NostrKind.TEXT_NOTE:
        case NostrKind.Long_Form:
            return <NoteCard emit={emit} event={event} profileData={authorProfile} publicKey={publicKey} />;
    }
}

function ReSent() {
    const styles = {
        container: `flex items-center cursor-pointer`,
        icon: `w-2 h-2 text-[${ErrorColor}] fill-current mr-2`,
        text: `text-xs text-[${ErrorColor}]`,
    };

    return (
        <div class={styles.container}>
            <AboutIcon class={styles.icon} />
            <p class={styles.text}>Failed to send message</p>
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
