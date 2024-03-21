import {
    Component,
    ComponentChildren,
    createRef,
    Fragment,
    h,
    RefObject,
} from "https://esm.sh/preact@10.17.1";
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

interface Props {
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

export class MessageList extends Component<Props, MessageListState> {
    readonly messagesULElement = createRef<HTMLUListElement>();

    state = {
        offset: 0,
    };

    jitter = new JitterPrevention(100);

    async componentDidUpdate(previousProps: Readonly<Props>) {
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
        const messages_to_render = this.sortAndSliceMessage();
        const groups = groupContinuousMessages(messages_to_render, (pre, cur) => {
            const sameAuthor = pre.event.pubkey == cur.event.pubkey;
            const _66sec = Math.abs(cur.created_at.getTime() - pre.created_at.getTime()) <
                1000 * 60;
            const is_not_reply = cur.event.parsedTags.e.length > 0; // todo: make a isReply(event) function
            return sameAuthor && _66sec && is_not_reply;
        });
        const messageBoxGroups = [];
        for (const messages of groups) {
            const profileEvent = this.props.getters.profileGetter.getProfilesByPublicKey(messages[0].author);
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
            <div class="w-full flex flex-col overflow-auto">
                <button class={`${IconButtonClass} shrink-0`} onClick={this.prePage}>
                    load earlier messages
                </button>
                {MessageListView(this.goToButtom, this.messagesULElement, messageBoxGroups)}
                <button class={`${IconButtonClass} shrink-0`} onClick={this.nextPage}>
                    load more messages
                </button>
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
        } else {
            await setState(this, { offset: 0 });
        }
    };

    nextPage = async () => {
        const offset = this.state.offset + ItemsOfPerPage / 2;
        if (offset < this.props.messages.length) {
            await setState(this, { offset });
        } else {
            await this.goToLastPage();
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

function MessageListView(
    goToButtom: (smooth: boolean) => void,
    messagesULElement: RefObject<HTMLUListElement>,
    messageBoxGroups: ComponentChildren,
) {
    return (
        <div
            class={`w-full overflow-hidden ${BackgroundColor_MessagePanel}`}
            style={{
                transform: "perspective(none)",
            }}
        >
            <button
                onClick={() => goToButtom(true)}
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
                ref={messagesULElement}
            >
                {messageBoxGroups}
            </ul>
        </div>
    );
}

export class MessageList_V0 extends Component<Props> {
    readonly messagesULElement = createRef<HTMLUListElement>();

    jitter = new JitterPrevention(100);

    async componentDidMount() {
        this.goToButtom(false);
    }

    componentDidUpdate(previousProps: Readonly<Props>): void {
        // todo: this is not a correct check of if new message is received
        // a better check is to see if the
        // current newest message is newer than previous newest message
        if (previousProps.messages.length < this.props.messages.length) {
            this.goToButtom(false);
        }
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

        return MessageListView(this.goToButtom, this.messagesULElement, messageBoxGroups);
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

    // check if the first message is a reply message
    function isReply(event: Parsed_Event) {
        if (event.parsedTags.e.length == 0) {
            return;
        }
        const reply_to_event = props.getters.getEventByID(event.parsedTags.e[0]);
        if (!reply_to_event) {
            return <ReplyTo unknown noteId={NoteID.FromString(event.parsedTags.e[0])} />;
        }
        let author = reply_to_event.publicKey.bech32();
        let picture = robohash(reply_to_event.publicKey.hex);
        if (reply_to_event.pubkey) {
            const profile = props.getters.profileGetter.getProfilesByPublicKey(reply_to_event.publicKey);
            if (profile) {
                author = profile.profile.name || profile.profile.display_name ||
                    reply_to_event?.publicKey.bech32();
                picture = profile.profile.picture || robohash(reply_to_event.publicKey.hex);
            }
        }
        return <ReplyTo content={reply_to_event.content} replyName={author} replayPic={picture} />;
    }

    rows.push(
        <li
            class={`px-4 hover:bg-[#32353B] w-full max-w-full flex flex-col pr-8 mobile:pr-4 group relative ${
                isMobile() ? "select-none" : ""
            }`}
        >
            {MessageActions(first_message, props.emit)}
            {isReply(first_message.event)}
            <div class="flex items-start">
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

function ReplyTo(
    props: { unknown?: false; content: string; replyName: string; replayPic: string } | {
        unknown: true;
        noteId: NoteID;
    },
) {
    return (
        <div class="w-full flex flex-row">
            <div class="w-10 h-5 shrink-0">
                <div class="w-5 h-2.5 border-l-2 border-t-2 rounded-tl translate-y-2.5 translate-x-4 border-[#4F5058]" />
            </div>
            <div class="flex flex-row w-full justify-start items-center text-[#A3A6AA] gap-2 font-roboto text-sm pr-5">
                {props.unknown
                    ? (
                        <div class="overflow-hidden whitespace-nowrap text-overflow-ellipsis">
                            {props.noteId.bech32()}
                        </div>
                    )
                    : (
                        <>
                            <Avatar class="h-4 w-4 shrink-0" picture={props.replayPic || ""} />
                            <div class="whitespace-nowrap md:shrink-0 truncate w-30">
                                @{props.replyName}
                            </div>
                            <div class="overflow-hidden whitespace-nowrap truncate text-overflow-ellipsis w-[90%]">
                                {props.content}
                            </div>
                        </>
                    )}
            </div>
        </div>
    );
}
