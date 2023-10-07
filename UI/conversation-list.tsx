/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Avatar } from "./components/avatar.tsx";
import { CenterClass, IconButtonClass, LinearGradientsClass } from "./components/tw.ts";
import { ConversationSummary, sortUserInfo } from "./conversation-list.ts";
import { emitFunc, EventSubscriber } from "../event-bus.ts";
import { PinIcon, UnpinIcon } from "./icons/mod.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { PinConversation, UnpinConversation } from "../nostr.ts";
import { PrimaryTextColor } from "./style/colors.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { ChatIcon } from "./icons2/chat-icon.tsx";
import { StartCreateGroupChat } from "./create-group.tsx";
import { GroupIcon } from "./icons2/group-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { UI_Interaction_Event } from "./app_update.tsx";

const IsGruopChatSupported = false;

export interface ConversationListRetriever extends GroupChatListGetter {
    getContacts: () => Iterable<ConversationSummary>;
    getStrangers: () => Iterable<ConversationSummary>;
    getConversationType(pubkey: PublicKey, isGourpChat: boolean): "Contacts" | "Strangers" | "Group";
}

export interface GroupChatListGetter {
    getGroupChat: () => Iterable<ConversationSummary>;
}

export type ConversationType = "Contacts" | "Strangers" | "Group";

export type ContactUpdate =
    | SearchUpdate
    | PinConversation
    | UnpinConversation
    | StartCreateGroupChat;

type Props = {
    emit: emitFunc<ContactUpdate | SearchUpdate>;
    eventBus: EventSubscriber<UI_Interaction_Event>;
    convoListRetriever: ConversationListRetriever;
    pinListGetter: PinListGetter;
    hasNewMessages: Set<string>;
};

type State = {
    selectedContactGroup: ConversationType;
    currentSelected: SelectConversation | undefined;
};

export class ConversationList extends Component<Props, State> {
    constructor() {
        super();
    }

    async componentDidMount() {
        for await (const e of this.props.eventBus.onChange()) {
            if (e.type == "SelectConversation") {
                this.setState({
                    currentSelected: e,
                    selectedContactGroup: this.props.convoListRetriever.getConversationType(
                        e.pubkey,
                        e.isGroupChat,
                    ),
                });
            }
        }
    }

    state: Readonly<State> = {
        selectedContactGroup: "Contacts",
        currentSelected: undefined,
    };

    render(props: Props) {
        let listToRender: ConversationSummary[];
        const contacts = Array.from(props.convoListRetriever.getContacts());
        const strangers = Array.from(props.convoListRetriever.getStrangers());
        const groups = Array.from(props.convoListRetriever.getGroupChat());
        switch (this.state.selectedContactGroup) {
            case "Contacts":
                listToRender = contacts;
                break;
            case "Strangers":
                listToRender = strangers;
                break;
            case "Group":
                listToRender = groups;
                break;
        }
        const convoListToRender = [];
        for (const conversationSummary of listToRender) {
            convoListToRender.push({
                conversation: conversationSummary,
                isMarked: props.hasNewMessages.has(conversationSummary.pubkey.hex),
            });
        }

        return (
            <div class={tw`h-full flex flex-col mobile:w-full desktop:w-64 bg-[#2F3136]`}>
                <div
                    class={tw`flex items-center gap-2 px-4 h-20 border-b border-[#36393F]`}
                >
                    <ButtonGroup class={tw`flex-1 ${LinearGradientsClass}} items-center`}>
                        <button
                            onClick={async () => {
                                props.emit({
                                    type: "StartSearch",
                                });
                            }}
                            class={tw`w-full h-10 ${CenterClass} text-sm text-[${PrimaryTextColor}] !hover:bg-transparent hover:font-bold group`}
                        >
                            <ChatIcon
                                class={tw`w-4 h-4m mr-1 text-[${PrimaryTextColor}] stroke-current`}
                                style={{
                                    fill: "none",
                                }}
                            />
                            New Chat
                        </button>
                        {IsGruopChatSupported
                            ? (
                                <Fragment>
                                    <div class={tw`h-4 w-1 bg-[${PrimaryTextColor}] !p-0`}></div>
                                    <button
                                        onClick={async () => {
                                            props.emit({
                                                type: "StartCreateGroupChat",
                                            });
                                        }}
                                        class={tw`w-full h-10 ${CenterClass} text-sm text-[${PrimaryTextColor}] !hover:bg-transparent hover:font-bold group`}
                                    >
                                        <GroupIcon
                                            class={tw`w-4 h-4 mr-1 text-[${PrimaryTextColor}] fill-current`}
                                        />
                                        New Group
                                    </button>
                                </Fragment>
                            )
                            : undefined}
                    </ButtonGroup>
                </div>

                <ul class={tw`bg-[#36393F] w-full flex h-[3rem] border-b border-[#36393F]`}>
                    <li
                        class={tw`h-full flex-1 cursor-pointer hover:text-[#F7F7F7] text-[#96989D] bg-[#2F3136] hover:bg-[#42464D] ${CenterClass} ${
                            this.state.selectedContactGroup == "Contacts"
                                ? "border-b-2 border-[#54D48C] bg-[#42464D] text-[#F7F7F7]"
                                : ""
                        }`}
                        onClick={() => this.setState({ selectedContactGroup: "Contacts" })}
                    >
                        Contacts: {contacts.length}
                    </li>
                    <li class={tw`w-[0.05rem] h-full bg-[#2F3136]`}></li>
                    <li
                        class={tw`h-full flex-1 cursor-pointer hover:text-[#F7F7F7] text-[#96989D] bg-[#2F3136] hover:bg-[#42464D] ${CenterClass} ${
                            this.state.selectedContactGroup == "Strangers"
                                ? "border-b-2 border-[#54D48C] bg-[#42464D] text-[#F7F7F7]"
                                : ""
                        }`}
                        onClick={() => {
                            this.setState({
                                selectedContactGroup: "Strangers",
                            });
                        }}
                    >
                        Strangers: {strangers.length}
                    </li>

                    {IsGruopChatSupported
                        ? (
                            <li
                                class={tw`h-full flex-1 cursor-pointer hover:text-[#F7F7F7] text-[#96989D] bg-[#2F3136] hover:bg-[#42464D] ${CenterClass} ${
                                    this.state.selectedContactGroup == "Group"
                                        ? "border-b-2 border-[#54D48C] bg-[#42464D] text-[#F7F7F7]"
                                        : ""
                                }`}
                                onClick={() => {
                                    this.setState({
                                        selectedContactGroup: "Group",
                                    });
                                }}
                            >
                                Group: {groups.length}
                            </li>
                        )
                        : undefined}
                </ul>

                <ContactGroup
                    contacts={Array.from(convoListToRender.values())}
                    currentSelected={this.state.currentSelected}
                    pinListGetter={props.pinListGetter}
                    isGroupChat={listToRender === groups}
                    emit={props.emit}
                />
            </div>
        );
    }
}

export interface PinListGetter {
    getPinList(): Set<string>;
}

type ConversationListProps = {
    contacts: { conversation: ConversationSummary; isMarked: boolean }[];
    currentSelected: SelectConversation | undefined;
    pinListGetter: PinListGetter;
    isGroupChat: boolean;
    emit: emitFunc<ContactUpdate>;
};

function ContactGroup(props: ConversationListProps) {
    props.contacts.sort((a, b) => {
        return sortUserInfo(a.conversation, b.conversation);
    });
    const pinList = props.pinListGetter.getPinList();
    const pinned = [];
    const unpinned = [];
    for (const contact of props.contacts) {
        if (pinList.has(contact.conversation.pubkey.hex)) {
            pinned.push(contact);
        } else {
            unpinned.push(contact);
        }
    }
    // console.log("ContactGroup", Date.now() - t);
    return (
        <ul class={tw`overflow-auto flex-1 p-2 text-[#96989D]`}>
            {pinned.map((contact) => {
                return (
                    <li
                        class={tw`${
                            props.currentSelected && contact.conversation.pubkey.hex ===
                                    props.currentSelected.pubkey.hex &&
                                props.isGroupChat == props.currentSelected.isGroupChat
                                ? "bg-[#42464D] text-[#FFFFFF]"
                                : "bg-[#42464D] text-[#96989D]"
                        } cursor-pointer p-2 hover:bg-[#3C3F45] my-2 rounded-lg flex items-center w-full relative group`}
                        onClick={selectConversation(
                            props.emit,
                            contact.conversation.pubkey,
                            props.isGroupChat,
                        )}
                    >
                        <ConversationListItem
                            conversation={contact.conversation}
                            isMarked={contact.isMarked}
                            isPinned={true}
                        />

                        <button
                            class={tw`w-6 h-6 absolute hidden group-hover:flex top-[-0.75rem] right-[0.75rem] ${IconButtonClass} bg-[#42464D] hover:bg-[#2F3136]`}
                            style={{
                                boxShadow: "2px 2px 5px 0 black",
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                props.emit({
                                    type: "UnpinConversation",
                                    pubkey: contact.conversation.pubkey.hex,
                                });
                            }}
                        >
                            <UnpinIcon
                                class={tw`w-4 h-4`}
                                style={{
                                    fill: "#ED4245",
                                }}
                            />
                        </button>
                    </li>
                );
            })}

            {unpinned.map((contact) => {
                return (
                    <li
                        class={tw`${
                            props.currentSelected && contact.conversation?.pubkey.hex ===
                                    props.currentSelected.pubkey.hex &&
                                props.isGroupChat == props.currentSelected.isGroupChat
                                ? "bg-[#42464D] text-[#FFFFFF]"
                                : "bg-transparent text-[#96989D]"
                        } cursor-pointer p-2 hover:bg-[#3C3F45] my-2 rounded-lg flex items-center w-full relative group`}
                        onClick={selectConversation(
                            props.emit,
                            contact.conversation.pubkey,
                            props.isGroupChat,
                        )}
                    >
                        <ConversationListItem
                            conversation={contact.conversation}
                            isMarked={contact.isMarked}
                            isPinned={false}
                        />

                        <button
                            class={tw`w-6 h-6 absolute hidden group-hover:flex top-[-0.75rem] right-[0.75rem] ${IconButtonClass} bg-[#42464D] hover:bg-[#2F3136]`}
                            style={{
                                boxShadow: "2px 2px 5px 0 black",
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                props.emit({
                                    type: "PinConversation",
                                    pubkey: contact.conversation.pubkey.hex,
                                });
                            }}
                        >
                            <PinIcon
                                class={tw`w-4 h-4`}
                                style={{
                                    fill: "rgb(185, 187, 190)",
                                    stroke: "rgb(185, 187, 190)",
                                    strokeWidth: 2,
                                }}
                            />
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

type ListItemProps = {
    conversation: ConversationSummary;
    isMarked: boolean;
    isPinned: boolean;
};

function ConversationListItem(props: ListItemProps) {
    return (
        <Fragment>
            <Avatar
                class={tw`w-8 h-8 mr-2`}
                picture={props.conversation.profile?.profile.picture}
            />
            <div
                class={tw`flex-1 overflow-hidden relative`}
            >
                <p class={tw`truncate w-full`}>
                    {props.conversation.profile?.profile.name || props.conversation.pubkey.bech32()}
                </p>
                {props.conversation.newestEventReceivedByMe !== undefined
                    ? (
                        <p
                            class={tw`text-[#78828B] text-[0.8rem] truncate`}
                        >
                            {new Date(
                                props.conversation.newestEventReceivedByMe
                                    .created_at * 1000,
                            ).toLocaleString()}
                        </p>
                    )
                    : undefined}

                {props.isMarked
                    ? (
                        <span
                            class={tw`absolute rounded-full h-2 w-2 bottom-2 right-2 bg-[#54D48C]`}
                        >
                        </span>
                    )
                    : undefined}
                {props.isPinned
                    ? (
                        <PinIcon
                            class={tw`w-3 h-3 absolute top-0 right-0`}
                            style={{
                                fill: "rgb(185, 187, 190)",
                                stroke: "rgb(185, 187, 190)",
                                strokeWidth: 2,
                            }}
                        />
                    )
                    : undefined}
            </div>
        </Fragment>
    );
}

const selectConversation =
    (emit: emitFunc<SelectConversation>, pubkey: PublicKey, isGroupChat: boolean) => () => {
        emit({
            type: "SelectConversation",
            pubkey,
            isGroupChat,
        });
    };
