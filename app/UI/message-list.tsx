import { Component, createRef, Fragment, FunctionComponent, h } from "https://esm.sh/preact@10.17.1";
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
import { EventID } from "../../libs/nostr.ts/nostr.ts";
import { VirtualList } from "./components/virtual-list.tsx";

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
    rootHeight: number;
}

export class MessageList extends Component<Props, State> {
    state: State = {
        rootHeight: 600,
    };

    rootRef = createRef<HTMLDivElement>();

    // update rootHeight
    async componentDidMount() {
        await sleep(100);
        const rootHeight = this.rootRef.current?.clientHeight || 600;
        setState(this, { rootHeight });
    }

    render() {
        const messages_to_container = sortMessage(this.props.messages);
        const groups = groupContinuousMessages(messages_to_container, (pre, cur) => {
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
            <div ref={this.rootRef} class={`w-full h-full`}>
                <VirtualList
                    height={this.state.rootHeight}
                    itemSize={getItemSize}
                    itemCount={this.props.messages.length}
                    myPublicKey={this.props.myPublicKey}
                    messages={this.props.messages}
                    emit={this.props.emit}
                    getters={this.props.getters}
                >
                    {Row}
                </VirtualList>
            </div>
        );
    }
}

function getItemSize(index: number) {
    return 100;
}

export interface RowProps {
    key: number;
    index: number;
    style: Record<string, string | number>;
    messages: ChatMessage[];
    emit: emitFunc<DirectMessagePanelUpdate | ViewUserDetail | SelectConversation | SyncEvent>;
    myPublicKey: PublicKey;
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        getEventByID: func_GetEventByID;
    };
}

const Row: FunctionComponent<RowProps> = (
    { index, style, messages, emit, myPublicKey, getters },
) => {
    const message = messages[index];
    return (
        <li
            style={style}
            id={`event_${message.event.id}`}
        >
            {MessageActions(message, emit)}
            {Time(message.created_at)}
            <div
                class={`flex-1`}
                style={{
                    maxWidth: "calc(100% - 2.75rem)",
                }}
            >
                <pre
                    class={`text-[#DCDDDE] whitespace-pre-wrap break-words font-roboto`}
                >
                    {ParseMessageContent(message, emit, getters)}
                </pre>
            </div>
        </li>
    );
};

export type func_GetEventByID = (
    id: string | NoteID,
) => Parsed_Event | undefined;

export interface MessageGroupProps {
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
}

function MessageBoxGroup(props: MessageGroupProps) {
    const first_message = props.messages[0];
    const rows = [];
    rows.push(
        <li
            class={`px-4 mt-2 hover:bg-[#32353B] w-full max-w-full flex items-start pr-8 mobile:pr-4 group relative ${
                isMobile() ? "select-none" : ""
            }`}
            id={`event_${first_message.event.id}`}
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
                id={`event_${msg.event.id}`}
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
