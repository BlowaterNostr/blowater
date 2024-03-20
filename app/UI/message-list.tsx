import { Component, createRef, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { RelayRecordGetter } from "../database.ts";
import { emitFunc } from "../event-bus.ts";
import { IconButtonClass } from "./components/tw.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import {
    DirectMessagePanelUpdate,
    NameAndTime,
    ParseMessageContent,
    SyncEvent,
    Time,
    ViewUserDetail,
} from "./message-panel.tsx";
import { ChatMessage, groupContinuousMessages, sortMessage } from "./message.ts";
import { ProfileGetter } from "./search.tsx";
import { SelectConversation } from "./search_model.ts";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { ProfileData } from "../features/profile.ts";
import { isMobile, setState } from "./_helper.ts";
import { Avatar } from "./components/avatar.tsx";
import { AboutIcon } from "./icons/about-icon.tsx";
import { BackgroundColor_MessagePanel, PrimaryTextColor } from "./style/colors.ts";
import { Parsed_Event } from "../nostr.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { robohash } from "./relay-detail.tsx";

interface MessageListProps {
    myPublicKey: PublicKey;
    messages: ChatMessage[];
    emit: emitFunc<DirectMessagePanelUpdate | SelectConversation | SyncEvent>;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        getEventByID: func_GetEventByID;
    };
}

interface MessageListState {
    offset: number;
}

const ItemsOfPerPage = 50;

export class MessageList extends Component<MessageListProps, MessageListState> {
    readonly messagesULElement = createRef<HTMLUListElement>();

    state = {
        offset: 0,
    };

    jitter = new JitterPrevention(100);

    async componentDidUpdate(previousProps: Readonly<MessageListProps>) {
        const newest = last(this.props.messages);
        const pre_newest = last(previousProps.messages);
        if (
            newest && pre_newest && newest.author.hex == this.props.myPublicKey.hex &&
            newest.event.id != pre_newest.event.id
        ) {
            await this.goToLastPage();
            this.goToButtom(false);
        }
    }

    async componentDidMount() {
        const offset = this.props.messages.length - ItemsOfPerPage;
        await setState(this, { offset: offset <= 0 ? 0 : offset });
    }

    render() {
        console.log(this.state.offset, this.props.messages.length);
        const messages_to_render = this.sortAndSliceMessage();
        let modeArr: ("normal" | "head" | "reply")[] = [];
        for (let i = messages_to_render.length - 1; i >= 0; i--) {
            if (messages_to_render[i].event.parsedTags.e.length > 0) {
                modeArr[i] = "reply";
                continue;
            }
            if (i == messages_to_render.length - 1) {
                modeArr[i] = "head";
                continue;
            }
            if (
                messages_to_render[i].event.pubkey == messages_to_render[i + 1].event.pubkey &&
                Math.abs(
                        messages_to_render[i].created_at.getTime() -
                            messages_to_render[i + 1].created_at.getTime(),
                    ) < 1000 * 60
            ) {
                if (modeArr[i + 1] != "reply") modeArr[i + 1] = "normal";
                modeArr[i] = "head";
                continue;
            }
            modeArr[i] = "head";
        }
        const messageItems = [];
        for (let i = 0; i < messages_to_render.length; i++) {
            if (modeArr[i] == "head") {
                messageItems.push(
                    <MessageItem
                        mode={"head"}
                        msg={messages_to_render[i]}
                        emit={this.props.emit}
                        getters={this.props.getters}
                        authorProfile={this.props.getters.profileGetter.getProfilesByPublicKey(
                            messages_to_render[i].author,
                        )?.profile}
                        myPublicKey={this.props.myPublicKey}
                    />,
                );
            } else if (modeArr[i] == "normal") {
                messageItems.push(
                    <MessageItem
                        mode={"normal"}
                        msg={messages_to_render[i]}
                        emit={this.props.emit}
                        getters={this.props.getters}
                    />,
                );
            } else if (modeArr[i] == "reply") {
                const replyTo = this.props.getters.getEventByID(messages_to_render[i].event.parsedTags.e[0]);
                messageItems.push(
                    <MessageItem
                        mode={"reply"}
                        msg={messages_to_render[i]}
                        emit={this.props.emit}
                        getters={this.props.getters}
                        authorProfile={this.props.getters.profileGetter.getProfilesByPublicKey(
                            messages_to_render[i].author,
                        )?.profile}
                        myPublicKey={this.props.myPublicKey}
                        replyTo={replyTo}
                    />,
                );
            }
        }

        return (
            <div
                class={`w-full overflow-hidden ${BackgroundColor_MessagePanel}`}
                style={{
                    transform: "perspective(none)",
                }}
            >
                <button
                    onClick={() => this.goToButtom(true)}
                    class={`${IconButtonClass} fixed z-10 bottom-8 right-4 h-10 w-10 rotate-[-90deg] bg-[#42464D] hover:bg-[#2F3136]`}
                >
                    <LeftArrowIcon
                        class={`w-6 h-6`}
                        style={{
                            fill: "#F3F4EA",
                        }}
                    />
                </button>
                <ul
                    class={`w-full h-full overflow-y-auto overflow-x-hidden py-9 mobile:py-2 px-2 mobile:px-0 flex flex-col`}
                    ref={this.messagesULElement}
                >
                    <button class={`${IconButtonClass}`} onClick={this.prePage}>
                        load earlier messages
                    </button>
                    {messageItems}
                    <button class={`${IconButtonClass}`} onClick={this.nextPage}>
                        load more messages
                    </button>
                </ul>
            </div>
        );
    }

    sortAndSliceMessage = () => {
        return sortMessage(this.props.messages)
            .slice(
                this.state.offset,
                this.state.offset + ItemsOfPerPage,
            );
    };

    prePage = async () => {
        const offset = this.state.offset - ItemsOfPerPage / 2;
        if (offset > 0) {
            await setState(this, { offset });
        }
    };

    nextPage = async () => {
        const offset = this.state.offset + ItemsOfPerPage / 2;
        if (offset < this.props.messages.length) {
            await setState(this, { offset });
        }
    };

    goToButtom = (smooth: boolean) => {
        if (this.messagesULElement.current) {
            this.messagesULElement.current.scrollTo({
                top: this.messagesULElement.current.scrollHeight,
                left: 0,
                behavior: smooth ? "smooth" : undefined,
            });
        }
    };

    goToLastPage = async () => {
        const newOffset = this.props.messages.length - ItemsOfPerPage / 2;
        await setState(this, {
            offset: newOffset > 0 ? newOffset : 0,
        });
        console.log("goToLastPage", this.state.offset);
    };
}

export class MessageList_V0 extends Component<MessageListProps> {
    readonly messagesULElement = createRef<HTMLUListElement>();

    jitter = new JitterPrevention(100);

    async componentDidMount() {
        this.goToButtom(false);
    }

    componentDidUpdate(previousProps: Readonly<MessageListProps>): void {
        // todo: this is not a correct check of if new message is received
        // a better check is to see if the
        // current newest message is newer than previous newest message
        if (previousProps.messages.length < this.props.messages.length) {
            this.goToButtom(false);
        }
    }

    render() {
        const messages_to_render = this.sortAndSliceMessage();
        let modeArr: ("normal" | "head" | "reply")[] = [];
        for (let i = messages_to_render.length - 1; i >= 0; i--) {
            if (messages_to_render[i].event.parsedTags.e.length > 0) {
                modeArr[i] = "reply";
                continue;
            }
            if (i == messages_to_render.length - 1) {
                modeArr[i] = "head";
                continue;
            }
            if (
                messages_to_render[i].event.pubkey == messages_to_render[i + 1].event.pubkey &&
                Math.abs(
                        messages_to_render[i].created_at.getTime() -
                            messages_to_render[i + 1].created_at.getTime(),
                    ) < 1000 * 60
            ) {
                if (modeArr[i + 1] != "reply") modeArr[i + 1] = "normal";
                modeArr[i] = "head";
                continue;
            }
            modeArr[i] = "head";
        }
        const messageItems = [];
        for (let i = 0; i < messages_to_render.length; i++) {
            if (modeArr[i] == "head") {
                messageItems.push(
                    <MessageItem
                        mode={"head"}
                        msg={messages_to_render[i]}
                        emit={this.props.emit}
                        getters={this.props.getters}
                        authorProfile={this.props.getters.profileGetter.getProfilesByPublicKey(
                            messages_to_render[i].author,
                        )?.profile}
                        myPublicKey={this.props.myPublicKey}
                    />,
                );
            } else if (modeArr[i] == "normal") {
                messageItems.push(
                    <MessageItem
                        mode={"normal"}
                        msg={messages_to_render[i]}
                        emit={this.props.emit}
                        getters={this.props.getters}
                    />,
                );
            } else if (modeArr[i] == "reply") {
                const replyTo = this.props.getters.getEventByID(messages_to_render[i].event.parsedTags.e[0]);
                messageItems.push(
                    <MessageItem
                        mode={"reply"}
                        msg={messages_to_render[i]}
                        emit={this.props.emit}
                        getters={this.props.getters}
                        authorProfile={this.props.getters.profileGetter.getProfilesByPublicKey(
                            messages_to_render[i].author,
                        )?.profile}
                        myPublicKey={this.props.myPublicKey}
                        replyTo={replyTo}
                    />,
                );
            }
        }

        return (
            <div
                class={`w-full overflow-hidden ${BackgroundColor_MessagePanel}`}
                style={{
                    transform: "perspective(none)",
                }}
            >
                <button
                    id="go to bottom"
                    onClick={() => this.goToButtom(true)}
                    class={`${IconButtonClass} fixed z-10 bottom-8 right-4 h-10 w-10 rotate-[-90deg] bg-[#42464D] hover:bg-[#2F3136]`}
                >
                    <LeftArrowIcon
                        class={`w-6 h-6`}
                        style={{
                            fill: "#F3F4EA",
                        }}
                    />
                </button>
                <ul
                    class={`w-full h-full overflow-y-auto overflow-x-hidden py-9 mobile:py-2 px-2 mobile:px-0 flex flex-col`}
                    ref={this.messagesULElement}
                >
                    {messageItems}
                </ul>
            </div>
        );
    }

    sortAndSliceMessage = () => {
        return sortMessage(this.props.messages);
    };

    goToButtom = (smooth: boolean) => {
        if (this.messagesULElement.current) {
            this.messagesULElement.current.scrollTo({
                top: this.messagesULElement.current.scrollHeight,
                left: 0,
                behavior: smooth ? "smooth" : undefined,
            });
        }
    };
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

export type func_GetEventByID = (
    id: string | NoteID,
) => Parsed_Event | undefined;

type MessageItemProps = {
    mode: "normal";
    msg: ChatMessage;
    emit: emitFunc<
        DirectMessagePanelUpdate | ViewUserDetail | SelectConversation | SyncEvent
    >;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        getEventByID: func_GetEventByID;
    };
} | {
    mode: "head";
    msg: ChatMessage;
    emit: emitFunc<
        DirectMessagePanelUpdate | ViewUserDetail | SelectConversation | SyncEvent
    >;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        getEventByID: func_GetEventByID;
    };
    authorProfile: ProfileData | undefined;
    myPublicKey: PublicKey;
} | {
    mode: "reply";
    msg: ChatMessage;
    emit: emitFunc<
        DirectMessagePanelUpdate | ViewUserDetail | SelectConversation | SyncEvent
    >;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        getEventByID: func_GetEventByID;
    };
    authorProfile: ProfileData | undefined;
    myPublicKey: PublicKey;
    replyTo?: Parsed_Event;
};

function MessageItem(props: MessageItemProps) {
    if (props.mode == "normal") {
        return (
            <li
                class={`px-4 hover:bg-[#32353B] w-full max-w-full flex items-center pr-8 mobile:pr-4 group relative text-sm ${
                    isMobile() ? "select-none" : ""
                }`}
            >
                {MessageActions(props.msg, props.emit)}
                {Time(props.msg.created_at)}
                <div
                    class={`flex-1`}
                    style={{
                        maxWidth: "calc(100% - 2.75rem)",
                    }}
                >
                    <pre
                        class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                    >
                    {ParseMessageContent(props.msg, props.emit, props.getters)}
                    </pre>
                </div>
            </li>
        );
    } else if (props.mode == "head") {
        return (
            <li
                class={`px-4 pt-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 mobile:pr-4 group relative ${
                    isMobile() ? "select-none" : ""
                }`}
            >
                {MessageActions(props.msg, props.emit)}
                <Avatar
                    class={`h-8 w-8 mt-[0.45rem] mr-2`}
                    picture={props.authorProfile?.picture ||
                        robohash(props.msg.author.hex)}
                    onClick={() => {
                        props.emit({
                            type: "ViewUserDetail",
                            pubkey: props.msg.author,
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
                        props.msg.author,
                        props.authorProfile,
                        props.myPublicKey,
                        props.msg.created_at,
                    )}
                    <pre
                        class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto text-sm`}
                    >
                    {ParseMessageContent(
                        props.msg,
                        props.emit,
                        props.getters,
                        )}
                    </pre>
                </div>
            </li>
        );
    } else {
        if (!props.replyTo) {
            return (
                <li
                    class={`px-4 pt-4 hover:bg-[#32353B] w-full max-w-full flex flex-col pr-8 mobile:pr-4 group relative ${
                        isMobile() ? "select-none" : ""
                    }`}
                >
                    {MessageActions(props.msg, props.emit)}
                    <div class="w-full flex flex-row">
                        <div class="w-10 h-5 shrink-0">
                            <div class="w-5 h-2.5 border-l-2 border-t-2 rounded-tl translate-y-2.5 translate-x-4 border-[#A3A6AA]" />
                        </div>
                        <div class="flex flex-row justify-start items-center text-[#A3A6AA] gap-2
                        font-roboto text-sm">
                            <div class="overflow-hidden whitespace-nowrap text-overflow-ellipsis ">
                                {props.msg.event.parsedTags.e[0]}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-start">
                        <Avatar
                            class={`h-8 w-8 mt-[0.45rem] mr-2`}
                            picture={props.authorProfile?.picture ||
                                robohash(props.msg.author.hex)}
                            onClick={() => {
                                props.emit({
                                    type: "ViewUserDetail",
                                    pubkey: props.msg.author,
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
                                props.msg.author,
                                props.authorProfile,
                                props.myPublicKey,
                                props.msg.created_at,
                            )}
                            <pre
                                class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto text-sm`}
                            >
                    {ParseMessageContent(
                        props.msg,
                        props.emit,
                        props.getters,
                        )}
                            </pre>
                        </div>
                    </div>
                </li>
            );
        }
        const replyProfile = props.getters.profileGetter.getProfilesByPublicKey(props.replyTo.publicKey)
            ?.profile;
        const replyPicture = replyProfile?.picture || robohash(props.replyTo.publicKey.hex);
        const replyName = replyProfile?.name || replyProfile?.display_name ||
            props.replyTo.publicKey.hex.slice(0, 6);
        return (
            <li
                class={`px-4 pt-4 hover:bg-[#32353B] w-full max-w-full flex flex-col pr-8 mobile:pr-4 group relative ${
                    isMobile() ? "select-none" : ""
                }`}
            >
                {MessageActions(props.msg, props.emit)}
                <div class="w-full flex flex-row">
                    <div class="w-10 h-5 shrink-0">
                        <div class="w-5 h-2.5 border-l-2 border-t-2 rounded-tl translate-y-2.5 translate-x-4 border-[#A3A6AA]" />
                    </div>
                    <div class="flex flex-row justify-start items-center text-[#A3A6AA] gap-2
                        font-roboto text-sm">
                        <div
                            class={`h-4 w-4`}
                        >
                            <Avatar
                                class={`h-4 w-4`}
                                picture={replyPicture}
                            />
                        </div>
                        <div class="whitespace-nowrap">
                            @{replyName}
                        </div>
                        <div class="overflow-hidden whitespace-nowrap text-overflow-ellipsis ">
                            {props.replyTo.content}
                        </div>
                    </div>
                </div>
                <div class="flex items-start">
                    <Avatar
                        class={`h-8 w-8 mt-[0.45rem] mr-2`}
                        picture={props.authorProfile?.picture ||
                            robohash(props.msg.author.hex)}
                        onClick={() => {
                            props.emit({
                                type: "ViewUserDetail",
                                pubkey: props.msg.author,
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
                            props.msg.author,
                            props.authorProfile,
                            props.myPublicKey,
                            props.msg.created_at,
                        )}
                        <pre
                            class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto text-sm`}
                        >
                    {ParseMessageContent(
                        props.msg,
                        props.emit,
                        props.getters,
                        )}
                        </pre>
                    </div>
                </div>
            </li>
        );
    }
}

function MessageActions(
    message: ChatMessage,
    emit: emitFunc<DirectMessagePanelUpdate>,
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

function last<T>(array: Array<T>): T | undefined {
    if (array.length == 0) {
        return undefined;
    } else {
        return array[array.length - 1];
    }
}
