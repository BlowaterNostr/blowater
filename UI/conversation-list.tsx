/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Avatar } from "./components/avatar.tsx";
import { CenterClass, LinearGradientsClass } from "./components/tw.ts";
import { ConversationSummary, sortUserInfo } from "./conversation-list.ts";
import { emitFunc } from "../event-bus.ts";
import { PinIcon, UnpinIcon } from "./icons/mod.tsx";
import { SearchUpdate } from "./search_model.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { PinConversation,UnpinConversation } from "../nostr.ts";
import { ButtonGroup } from "./components/button-group.tsx";
import { StartCreateGroupChat } from "./create-group.tsx";
import { PrimaryTextColor } from "./style/colors.ts";
import { ChatIcon } from "./icons2/chat-icon.tsx";
import { GroupIcon } from "./icons2/group-icon.tsx";

export interface ConversationListRetriever {
    getContacts: () => Iterable<ConversationSummary>;
    getStrangers: () => Iterable<ConversationSummary>;
    getGroupChat: () => Iterable<ConversationSummary>;
}

export type ConversationType = "Contacts" | "Strangers" | "Group";

export type ContactUpdate =
    | SelectConversationType
    | SearchUpdate
    | PinConversation
    | UnpinConversation
    | StartCreateGroupChat;

export type SelectConversationType = {
    type: "SelectConversationType";
    group: ConversationType;
};

type Props = {
    emit: emitFunc<ContactUpdate | SearchUpdate>;
    convoListRetriever: ConversationListRetriever;
    currentSelected: PublicKey | undefined;
    selectedContactGroup: ConversationType;
    pinListGetter: PinListGetter;
    hasNewMessages: Set<string>;
};
export function ConversationList(props: Props) {
    const contacts = Array.from(props.convoListRetriever.getContacts());
    const strangers = Array.from(props.convoListRetriever.getStrangers());
    const groups = Array.from(props.convoListRetriever.getGroupChat());
    let listToRender: ConversationSummary[];
    switch (props.selectedContactGroup) {
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
    for (const contact of listToRender) {
        convoListToRender.push({
            userInfo: contact,
            isMarked: props.hasNewMessages.has(contact.pubkey.hex),
        });
    }

    return (
        <div class={tw`h-full flex flex-col mobile:w-full desktop:w-64 bg-[#2F3136]`}>
            <div
                class={tw`flex items-center gap-2 px-4 h-20 border-b border-[#36393F]`}
            >
                <ButtonGroup class={tw`flex-1 ${LinearGradientsClass}} items-center`}>
                    <button
                        onClick={() => {
                            props.emit({
                                type: "StartSearch",
                            });
                        }}
                        class={tw`w-full h-10 ${CenterClass} text-sm text-[${PrimaryTextColor}] !hover:bg-transparent hover:font-bold group`}
                    >
                        <ChatIcon
                            class={tw`w-4 h-4 mr-1 text-[${PrimaryTextColor}] stroke-current stroke-2`}
                            style={{
                                fill: "none",
                            }}
                        />
                        New Chat
                    </button>
                    <div class={tw`h-4 w-1 bg-[${PrimaryTextColor}] !p-0`}></div>
                    <button
                        onClick={() => {
                            props.emit({
                                type: "StartCreateGroupChat",
                            });
                        }}
                        class={tw`w-full h-10 ${CenterClass} text-sm text-[${PrimaryTextColor}] !hover:bg-transparent hover:font-bold group`}
                    >
                        <GroupIcon
                            class={tw`w-4 h-4 mr-1 text-[${PrimaryTextColor}] fill-current stroke-2`}
                        />
                        New Group
                    </button>
                </ButtonGroup>
            </div>

            <ul class={tw`bg-[#36393F] w-full flex h-[3rem] border-b border-[#36393F]`}>
                <li
                    class={tw`h-full flex-1 cursor-pointer hover:text-[#F7F7F7] text-[#96989D] bg-[#2F3136] hover:bg-[#42464D] ${CenterClass} ${
                        props.selectedContactGroup == "Contacts"
                            ? "border-b-2 border-[#54D48C] bg-[#42464D] text-[#F7F7F7]"
                            : ""
                    }`}
                    onClick={() => {
                        props.emit({
                            type: "SelectConversationType",
                            group: "Contacts",
                        });
                    }}
                >
                    Contacts
                </li>
                <li class={tw`w-[0.05rem] h-full bg-[#2F3136]`}></li>
                <li
                    class={tw`h-full flex-1 cursor-pointer hover:text-[#F7F7F7] text-[#96989D] bg-[#2F3136] hover:bg-[#42464D] ${CenterClass} ${
                        props.selectedContactGroup == "Strangers"
                            ? "border-b-2 border-[#54D48C] bg-[#42464D] text-[#F7F7F7]"
                            : ""
                    }`}
                    onClick={() => {
                        props.emit({
                            type: "SelectConversationType",
                            group: "Strangers",
                        });
                    }}
                >
                    Strangers
                </li>
                <li
                    class={tw`h-full flex-1 cursor-pointer hover:text-[#F7F7F7] text-[#96989D] bg-[#2F3136] hover:bg-[#42464D] ${CenterClass} ${
                        props.selectedContactGroup == "Group"
                            ? "border-b-2 border-[#54D48C] bg-[#42464D] text-[#F7F7F7]"
                            : ""
                    }`}
                    onClick={() => {
                        props.emit({
                            type: "SelectConversationType",
                            group: "Group",
                        });
                    }}
                >
                    Group
                </li>
            </ul>

            <ContactGroup
                contacts={Array.from(convoListToRender.values())}
                currentSelected={props.currentSelected}
                pinListGetter={props.pinListGetter}
                emit={props.emit}
            />
        </div>
    );
}

export interface PinListGetter {
    getPinList(): Set<string>;
}

type ConversationListProps = {
    contacts: { userInfo: ConversationSummary; isMarked: boolean }[];
    currentSelected: PublicKey | undefined;
    pinListGetter: PinListGetter;
    emit: emitFunc<ContactUpdate>;
};

function ContactGroup(props: ConversationListProps) {
    const t = Date.now();
    props.contacts.sort((a, b) => {
        return sortUserInfo(a.userInfo, b.userInfo);
    });
    const pinList = props.pinListGetter.getPinList();
    const pinned = [];
    const unpinned = [];
    for (const contact of props.contacts) {
        if (pinList.has(contact.userInfo.pubkey.hex)) {
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
                            props.currentSelected && contact.userInfo.pubkey.hex ===
                                    props.currentSelected.hex
                                ? "bg-[#42464D] text-[#FFFFFF]"
                                : "bg-[#42464D] text-[#96989D]"
                        } cursor-pointer p-2 hover:bg-[#3C3F45] my-2 rounded-lg flex items-center w-full relative group`}
                        onClick={() => {
                            props.emit({
                                type: "SelectConversation",
                                pubkey: contact.userInfo.pubkey,
                            });
                        }}
                    >
                        <ConversationListItem
                            userInfo={contact.userInfo}
                            isMarked={contact.isMarked}
                            isPinned={true}
                        />

                        <ButtonGroup
                            class={tw`hidden group-hover:flex absolute top-[-0.75rem] right-[1rem]`}
                            style={{
                                boxShadow: "2px 2px 5px 0 black",
                            }}
                        >
                            {/* <button
                                class={tw`w-6 h-6 flex items-center justify-center`}
                                onClick={e => {
                                    e.stopPropagation();

                                }}
                            >
                                <InviteIcon
                                    class={tw`w-4 h-4 scale-150`}
                                    style={{
                                        fill: PrimaryTextColor,
                                    }}
                                />
                            </button> */}

                            <button
                                class={tw`w-6 h-6 flex items-center justify-center`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    props.emit({
                                        type: "UnpinConversation",
                                        pubkey: contact.userInfo.pubkey.hex,
                                    });
                                }}
                            >
                                <UnpinIcon
                                    class={tw`w-4 h-4 scale-150`}
                                    style={{
                                        fill: PrimaryTextColor,
                                    }}
                                />
                            </button>
                        </ButtonGroup>
                    </li>
                );
            })}

            {unpinned.map((contact) => {
                return (
                    <li
                        class={tw`${
                            props.currentSelected && contact.userInfo?.pubkey.hex ===
                                    props.currentSelected.hex
                                ? "bg-[#42464D] text-[#FFFFFF]"
                                : "bg-transparent text-[#96989D]"
                        } cursor-pointer p-2 hover:bg-[#3C3F45] my-2 rounded-lg flex items-center w-full relative group`}
                        onClick={() => {
                            props.emit({
                                type: "SelectConversation",
                                pubkey: contact.userInfo.pubkey,
                            });
                        }}
                    >
                        <ConversationListItem
                            userInfo={contact.userInfo}
                            isMarked={contact.isMarked}
                            isPinned={false}
                        />

                        <ButtonGroup
                            class={tw`hidden group-hover:flex absolute top-[-0.75rem] right-[1rem]`}
                            style={{
                                boxShadow: "2px 2px 5px 0 black",
                            }}
                        >
                            {/* <button
                                class={tw`w-6 h-6 flex items-center justify-center`}
                                onClick={e => {
                                    e.stopPropagation();

                                }}
                            >
                                <InviteIcon
                                    class={tw`w-4 h-4 scale-150`}
                                    style={{
                                        fill: PrimaryTextColor,
                                    }}
                                />
                            </button> */}

                            <button
                                class={tw`w-6 h-6 flex items-center justify-center`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    props.emit({
                                        type: "PinConversation",
                                        pubkey: contact.userInfo.pubkey.hex,
                                    });
                                }}
                            >
                                <PinIcon
                                    class={tw`w-4 h-4 scale-150`}
                                    style={{
                                        fill: PrimaryTextColor,
                                        stroke: PrimaryTextColor,
                                        strokeWidth: 2,
                                    }}
                                />
                            </button>
                        </ButtonGroup>
                    </li>
                );
            })}
        </ul>
    );
}

type ListItemProps = {
    userInfo: ConversationSummary;
    isMarked: boolean;
    isPinned: boolean;
};

function ConversationListItem(props: ListItemProps) {
    return (
        <Fragment>
            <Avatar
                class={tw`w-8 h-8 mr-2`}
                picture={props.userInfo.profile?.profile.picture}
            />
            <div
                class={tw`flex-1 overflow-hidden relative`}
            >
                <p class={tw`truncate w-full`}>
                    {props.userInfo.profile?.profile.name || props.userInfo.pubkey.bech32()}
                </p>
                {props.userInfo.newestEventReceivedByMe !== undefined
                    ? (
                        <p
                            class={tw`text-[#78828B] text-[0.8rem] truncate`}
                        >
                            {new Date(
                                props.userInfo.newestEventReceivedByMe
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
