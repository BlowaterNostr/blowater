/** @jsx h */
import { Component, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { emitFunc, EventSubscriber } from "../event-bus.ts";
import { ProfileData } from "../features/profile.ts";
import { PinConversation, UnpinConversation } from "../nostr.ts";
import { UI_Interaction_Event, UserBlocker } from "./app_update.tsx";
import { Avatar } from "./components/avatar.tsx";
import { CenterClass, LinearGradientsClass } from "./components/tw.ts";

import { ConversationSummary, sortUserInfo } from "./conversation-list.ts";

import { ChatIcon } from "./icons/chat-icon.tsx";
import { PinIcon } from "./icons/pin-icon.tsx";
import { UnpinIcon } from "./icons/unpin-icon.tsx";
import { func_GetProfileByPublicKey, func_GetProfilesByText } from "./search.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { ErrorColor, PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { ContactTag, ContactTags, TagSelected } from "./contact-tags.tsx";
import { ViewUserDetail } from "./message-panel.tsx";
import { robohash } from "../../libs/nostr.ts/nip11.ts";

export interface ConversationListRetriever {
    getContacts: () => Iterable<ConversationSummary>;
    getStrangers: () => Iterable<ConversationSummary>;
    getConversations: (keys: Iterable<string>) => Iterable<ConversationSummary>;
    getConversationType(pubkey: PublicKey): ConversationType;
}

export interface GroupMessageListGetter {
    getConversationList: () => Iterable<ConversationSummary>;
}

export type ConversationType = ContactTag;

export type ContactUpdate =
    | SearchUpdate
    | PinConversation
    | UnpinConversation;

export interface NewMessageChecker {
    newNessageCount(pubkey: PublicKey, isGourpChat: boolean): number;
    markRead(pubkey: PublicKey, isGourpChat: boolean): void;
}

type Props = {
    emit: emitFunc<ContactUpdate | SearchUpdate | TagSelected | ViewUserDetail>;
    eventSub: EventSubscriber<UI_Interaction_Event>;
    getters: {
        convoListRetriever: ConversationListRetriever;
        newMessageChecker: NewMessageChecker;
        pinListGetter: PinListGetter;
        getProfileByPublicKey: func_GetProfileByPublicKey;
        getProfilesByText: func_GetProfilesByText;
    };
    userBlocker: UserBlocker;
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
        for await (const e of this.props.eventSub.onChange()) {
            if (e.type == "SelectConversation") {
                this.setState({
                    currentSelected: e,
                    selectedContactGroup: this.props.getters.convoListRetriever.getConversationType(
                        e.pubkey,
                    ),
                });
            } else if (e.type == "tagSelected") {
                this.setState({
                    selectedContactGroup: e.tag,
                });
            }
        }
    }

    state: Readonly<State> = {
        selectedContactGroup: "contacts",
        currentSelected: undefined,
    };

    render(props: Props) {
        let listToRender: ConversationSummary[];
        const contacts = Array.from(props.getters.convoListRetriever.getContacts());
        const strangers = Array.from(props.getters.convoListRetriever.getStrangers());
        const blocked = props.userBlocker.getBlockedUsers();
        let isGroupChat = false;
        switch (this.state.selectedContactGroup) {
            case "contacts":
                listToRender = contacts;
                break;
            case "strangers":
                listToRender = strangers;
                break;
            case "blocked":
                listToRender = Array.from(props.getters.convoListRetriever.getConversations(blocked));
        }
        const convoListToRender = [];
        for (const conversationSummary of listToRender) {
            convoListToRender.push({
                conversation: conversationSummary,
                newMessageCount: props.getters.newMessageChecker.newNessageCount(
                    conversationSummary.pubkey,
                    isGroupChat,
                ),
            });
        }

        return (
            <div
                // https://tailwindcss.com/docs/hover-focus-and-other-states#quick-reference
                class={`
                h-screen w-60 max-sm:w-full
                flex flex-col bg-[${SecondaryBackgroundColor}]`}
            >
                <div
                    class={`gap-2 py-2.5 px-4 border-b border-[#36393F]`}
                >
                    <div class={`${LinearGradientsClass} flex items-center justify-center rounded-lg`}>
                        <button
                            onClick={async () => {
                                props.emit({
                                    type: "StartSearch",
                                });
                            }}
                            class={`w-full h-10 ${CenterClass} text-sm text-[${PrimaryTextColor}] !hover:bg-transparent hover:font-bold group`}
                        >
                            <ChatIcon
                                class={`w-4 h-4 mr-1 text-[${PrimaryTextColor}] stroke-current`}
                                style={{
                                    fill: "none",
                                }}
                            />
                            New Chat
                        </button>
                    </div>
                </div>

                <div class="py-1 border-b border-[#36393F]">
                    <ContactTags tags={["contacts", "strangers", "blocked"]} emit={this.props.emit}>
                    </ContactTags>
                </div>

                <ContactGroup
                    contacts={Array.from(convoListToRender.values())}
                    currentSelected={this.state.currentSelected}
                    emit={props.emit}
                    getters={props.getters}
                />
            </div>
        );
    }
}

export interface PinListGetter {
    getPinList(): Set<string>; // get a set of npubs that are pinned
}

type ConversationListProps = {
    contacts: { conversation: ConversationSummary; newMessageCount: number }[];
    currentSelected: SelectConversation | undefined;
    emit: emitFunc<ContactUpdate | ViewUserDetail>;
    getters: {
        pinListGetter: PinListGetter;
        getProfileByPublicKey: func_GetProfileByPublicKey;
    };
};

function ContactGroup(props: ConversationListProps) {
    props.contacts.sort((a, b) => {
        return sortUserInfo(a.conversation, b.conversation);
    });
    const pinList = props.getters.pinListGetter.getPinList();
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
        <ul class={`overflow-auto flex-1 p-2 text-[#96989D]`}>
            {pinned.map((contact) => {
                let profile;
                const profileEvent = props.getters.getProfileByPublicKey(
                    contact.conversation.pubkey,
                );
                if (profileEvent) {
                    profile = profileEvent.profile;
                }
                return (
                    <li
                        class={`${
                            props.currentSelected && contact.conversation.pubkey.hex ===
                                props.currentSelected.pubkey.hex &&
                            "bg-[#42464D] text-[#96989D]"
                        } cursor-pointer p-2 hover:bg-[#3C3F45] mb-2 rounded-lg flex items-center w-full relative group`}
                        onClick={selectConversation(
                            props.emit,
                            contact.conversation.pubkey,
                        )}
                    >
                        <ConversationListItem
                            conversation={contact.conversation}
                            newMessageCount={contact.newMessageCount}
                            isPinned={true}
                            profile={profile}
                        />

                        <button
                            class={`
                                w-6 h-6 absolute hidden group-hover:flex top-[-0.75rem] right-[0.75rem]
                                focus:outline-none focus-visible:outline-none rounded-full hover:bg-[#42464D] ${CenterClass}
                                bg-[#42464D] hover:bg-[#2F3136]`}
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
                                class={`w-4 h-4`}
                                style={{
                                    fill: "#ED4245",
                                }}
                            />
                        </button>
                    </li>
                );
            })}

            {unpinned.map((contact) => {
                let profile;
                const profileEvent = props.getters.getProfileByPublicKey(
                    contact.conversation.pubkey,
                );
                if (profileEvent) {
                    profile = profileEvent.profile;
                }
                return (
                    <li
                        class={`${
                            props.currentSelected && contact.conversation?.pubkey.hex ===
                                props.currentSelected.pubkey.hex &&
                            "bg-transparent text-[#96989D]"
                        } cursor-pointer p-2 hover:bg-[#3C3F45] my-2 rounded-lg flex items-center w-full relative group`}
                        onClick={selectConversation(
                            props.emit,
                            contact.conversation.pubkey,
                        )}
                    >
                        <ConversationListItem
                            conversation={contact.conversation}
                            newMessageCount={contact.newMessageCount}
                            isPinned={false}
                            profile={profile}
                        />

                        <button
                            class={`
                            w-6 h-6 absolute hidden group-hover:flex top-[-0.75rem] right-[0.75rem]
                            focus:outline-none focus-visible:outline-none rounded-full hover:bg-[#42464D] ${CenterClass}
                            bg-[#42464D] hover:bg-[#2F3136]`}
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
                                class={`w-4 h-4`}
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
    newMessageCount: number;
    isPinned: boolean;
    profile: ProfileData | undefined;
};

function ConversationListItem(props: ListItemProps) {
    return (
        <Fragment>
            <Avatar
                class={`w-8 h-8 mr-2`}
                picture={props.profile?.picture || robohash(props.conversation.pubkey.hex)}
            />
            <div
                class={`flex-1 overflow-hidden relative`}
            >
                <p class={`truncate w-full`}>
                    {props.profile?.name || props.conversation.pubkey.bech32()}
                </p>
                {props.conversation.newestEventReceivedByMe !== undefined
                    ? (
                        <p
                            class={`text-[#78828B] text-[0.8rem] truncate`}
                        >
                            {new Date(
                                props.conversation.newestEventReceivedByMe
                                    .created_at * 1000,
                            ).toLocaleString()}
                        </p>
                    )
                    : undefined}

                {props.newMessageCount > 0
                    ? (
                        <span
                            class={`absolute bottom-0 right-0 px-1 text-[${PrimaryTextColor}] text-xs rounded-full bg-[${ErrorColor}]`}
                        >
                            {props.newMessageCount}
                        </span>
                    )
                    : undefined}
                {props.isPinned
                    ? (
                        <PinIcon
                            class={`w-3 h-3 absolute top-0 right-0`}
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

const selectConversation = (emit: emitFunc<SelectConversation>, pubkey: PublicKey) => () => {
    emit({
        type: "SelectConversation",
        pubkey,
    });
};
