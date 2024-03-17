import { Component, createRef, h } from "https://esm.sh/preact@10.17.1";
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
        console.log("componentDidUpdate", newest, pre_newest);
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
        const messages_to_render = this.sortAndSliceMessage();
        const groups = groupContinuousMessages(messages_to_render, (pre, cur) => {
            const sameAuthor = pre.event.pubkey == cur.event.pubkey;
            const _66sec = Math.abs(cur.created_at.getTime() - pre.created_at.getTime()) <
                1000 * 60;
            return sameAuthor && _66sec;
        });
        const messageBoxGroups = [];
        for (const messages of groups) {
            const profileEvent = this.props.getters.profileGetter
                .getProfilesByPublicKey(messages[0].author);
            messageBoxGroups.push(
                MessageBoxGroup({
                    messages: messages,
                    myPublicKey: this.props.myPublicKey,
                    emit: this.props.emit,
                    authorProfile: profileEvent ? profileEvent.profile : undefined,
                    getters: this.props.getters,
                }),
            );
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
                    {messageBoxGroups}
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
        console.log(messages_to_render);
        const groups = groupContinuousMessages(messages_to_render, (pre, cur) => {
            const sameAuthor = pre.event.pubkey == cur.event.pubkey;
            const _66sec = Math.abs(cur.created_at.getTime() - pre.created_at.getTime()) <
                1000 * 60;
            return sameAuthor && _66sec;
        });
        const messageBoxGroups = [];
        for (const messages of groups) {
            const profileEvent = this.props.getters.profileGetter
                .getProfilesByPublicKey(messages[0].author);
            messageBoxGroups.push(
                MessageBoxGroup({
                    messages: messages,
                    myPublicKey: this.props.myPublicKey,
                    emit: this.props.emit,
                    authorProfile: profileEvent ? profileEvent.profile : undefined,
                    getters: this.props.getters,
                }),
            );
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
                    {messageBoxGroups}
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

function MessageBoxGroup(props: {
    authorProfile: ProfileData | undefined;
    messages: ChatMessage[];
    myPublicKey: PublicKey;
    emit: emitFunc<
        DirectMessagePanelUpdate | ViewUserDetail | SelectConversation | SyncEvent
    >;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        getEventByID: func_GetEventByID;
    };
}) {
    const first_message = props.messages[0];
    const rows = [];
    rows.push(
        <li
            class={`px-4 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 mobile:pr-4 group relative ${
                isMobile() ? "select-none" : ""
            }`}
        >
            {MessageActions(first_message, props.emit)}
            <Avatar
                class={`h-8 w-8 mt-[0.45rem] mr-2`}
                picture={props.authorProfile?.picture ||
                    robohash(first_message.author.hex)}
                onClick={() => {
                    props.emit({
                        type: "ViewUserDetail",
                        pubkey: first_message.author,
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
                    first_message.author,
                    props.authorProfile,
                    props.myPublicKey,
                    first_message.created_at,
                )}
                <pre
                    class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto text-sm`}
                >
                    {ParseMessageContent(
                        first_message,
                        props.emit,
                        props.getters,
                        )}
                </pre>
            </div>
        </li>,
    );

    for (let i = 1; i < props.messages.length; i++) {
        const msg = props.messages[i];
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
                    {ParseMessageContent(msg, props.emit, props.getters)}
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
