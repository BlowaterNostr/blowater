import { Component, createRef, h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { RelayRecordGetter } from "../database.ts";
import { emitFunc } from "../event-bus.ts";
import { IconButtonClass } from "./components/tw.ts";
import { EventSyncer } from "./event_syncer.ts";
import { LeftArrowIcon } from "./icons/left-arrow-icon.tsx";
import {
    DirectMessagePanelUpdate,
    NameAndTime,
    ParseMessageContent,
    Time,
    ViewUserDetail,
} from "./message-panel.tsx";
import { ChatMessage, groupContinuousMessages, sortMessage } from "./message.ts";
import { ProfileGetter } from "./search.tsx";
import { SelectConversation } from "./search_model.ts";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { ProfileData } from "../features/profile.ts";
import { isMobile } from "./_helper.ts";
import { Avatar } from "./components/avatar.tsx";
import { AboutIcon } from "./icons/about-icon.tsx";
import { PrimaryTextColor } from "./style/colors.ts";

interface MessageListProps {
    myPublicKey: PublicKey;
    messages: ChatMessage[];
    emit: emitFunc<DirectMessagePanelUpdate | SelectConversation>;
    eventSyncer: EventSyncer;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
    };
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
            const profileEvent = this.props.getters.profileGetter.getProfilesByPublicKey(messages[0].author);
            messageBoxGroups.push(
                MessageBoxGroup({
                    messages: messages,
                    myPublicKey: this.props.myPublicKey,
                    emit: this.props.emit,
                    eventSyncer: this.props.eventSyncer,
                    authorProfile: profileEvent ? profileEvent.profile : undefined,
                    getters: this.props.getters,
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

function MessageBoxGroup(props: {
    authorProfile: ProfileData | undefined;
    messages: ChatMessage[];
    myPublicKey: PublicKey;
    emit: emitFunc<DirectMessagePanelUpdate | ViewUserDetail | SelectConversation>;
    eventSyncer: EventSyncer;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
    };
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
                        props.getters.profileGetter,
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
                        props.getters.profileGetter
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
