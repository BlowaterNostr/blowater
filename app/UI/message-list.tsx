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

interface State {
    status: {
        type: "Latest"; // Automatically load the latest message when there is a new message.
    } | {
        type: "Browse"; // Manually load the message.
        offset: number;
    };
}

const ItemsOfPerPage = 20;

export class MessageList extends Component<Props, State> {
    readonly messagesULElement = createRef<HTMLOListElement>();

    state: State = {
        status: {
            type: "Latest",
        },
    };

    jitter = new JitterPrevention(100);

    async componentDidMount() {
        if (this.state.status.type == "Latest") {
        } else if (this.state.status.type == "Browse") {
            const offset = this.props.messages.length - ItemsOfPerPage;
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
                    onClick={this.goToButtom}
                    class={`${IconButtonClass} fixed z-10 bottom-8 right-4 h-10 w-10 rotate-[-90deg] bg-[#42464D] hover:bg-[#2F3136]`}
                >
                    <LeftArrowIcon
                        class={`w-6 h-6`}
                        style={{
                            fill: "#F3F4EA",
                        }}
                    />
                </button>
                <ol
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
                </ol>
            </div>
        );
    }

    sortAndSliceMessage = () => {
        const messages_len = this.props.messages.length;
        if (this.state.status.type == "Latest") {
            return sortMessage(this.props.messages).slice(
                messages_len > ItemsOfPerPage ? messages_len - ItemsOfPerPage : 0,
                messages_len,
            );
        } else if (this.state.status.type == "Browse") {
            return sortMessage(this.props.messages)
                .slice(
                    this.state.status.offset,
                    this.state.status.offset + ItemsOfPerPage,
                );
        } else {
            return [];
        }
    };

    prePage = async () => {
        if (this.state.status.type == "Latest") {
            await setState(this, {
                status: { type: "Browse", offset: this.props.messages.length - ItemsOfPerPage },
            });
        } else if (this.state.status.type == "Browse") {
            const offset = this.state.status.offset - ItemsOfPerPage / 2;
            await setState(this, { status: { type: "Browse", offset: offset > 0 ? offset : 0 } });
        }
    };

    nextPage = async () => {
        if (this.state.status.type == "Latest") {
            // nothing to do
        } else if (this.state.status.type == "Browse") {
            const offset = this.state.status.offset + ItemsOfPerPage / 2;
            if (offset < this.props.messages.length) {
                await setState(this, { status: { type: "Browse", offset } });
            } else {
                await setState(this, { status: { type: "Latest" } });
            }
        }
    };

    goToButtom = async () => {
        if (this.state.status.type == "Latest") {
            // nothing to do
        } else if (this.state.status.type == "Browse") {
            await setState(this, { status: { type: "Latest" } });
        }
        // if (this.messagesULElement.current) {
        //     this.messagesULElement.current.scrollTo({
        //         top: this.messagesULElement.current.scrollHeight,
        //         left: 0,
        //         behavior: "smooth",
        //     });
        // }
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
            class={`px-4 mt-2 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 mobile:pr-4 group relative ${
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
        <Fragment>
            {rows}
        </Fragment>
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
