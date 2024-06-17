/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { RelayRecordGetter } from "../database.ts";
import { emitFunc, EventSubscriber } from "../event-bus.ts";
import { ProfileData } from "../features/profile.ts";
import { Parsed_Event, PinConversation, UnpinConversation } from "../nostr.ts";
import { ChatMessagesGetter, UI_Interaction_Event } from "./app_update.tsx";
import { Editor, EditorEvent } from "./editor.tsx";

import { ChatMessage, parseContent, urlIsImage, urlIsVideo } from "./message.ts";
import { NoteCard } from "./note-card.tsx";
import { ProfileCard } from "./profile-card.tsx";
import { func_GetProfilesByText } from "./search.tsx";
import { SelectConversation } from "./search_model.ts";
import { BackgroundColor_MessagePanel, DividerBackgroundColor, LinkColor } from "./style/colors.ts";
import { BlockUser, UnblockUser } from "./user-detail.tsx";
import {
    DeleteEvent,
    func_GetEventByID,
    func_GetReactionsByEventID,
    func_IsAdmin,
    MessageList,
    ReplyToMessage,
} from "./message-list.tsx";
import { MessageList_V0 } from "./message-list.tsx";
import { func_GetProfileByPublicKey } from "./search.tsx";

export type DirectMessagePanelUpdate =
    | ViewUserDetail
    | OpenNote
    | {
        type: "ViewEventDetail";
        message: ChatMessage;
    };

export type OpenNote = {
    type: "OpenNote";
    event: NostrEvent;
};

export type SendReaction = {
    type: "SendReaction";
    event: NostrEvent;
    content: string;
};

export type ViewUserDetail = {
    type: "ViewUserDetail";
    pubkey: PublicKey;
};

interface MessagePanelProps {
    myPublicKey: PublicKey;
    emit: emitFunc<
        | EditorEvent
        | DirectMessagePanelUpdate
        | PinConversation
        | UnpinConversation
        | SelectConversation
        | BlockUser
        | UnblockUser
        | SyncEvent
        | ReplyToMessage
        | DeleteEvent
        | SendReaction
    >;
    eventSub: EventSubscriber<UI_Interaction_Event>;
    messages: ChatMessage[];
    getters: {
        messageGetter: ChatMessagesGetter;
        getProfileByPublicKey: func_GetProfileByPublicKey;
        getProfilesByText: func_GetProfilesByText;
        relayRecordGetter: RelayRecordGetter;
        isUserBlocked: (pubkey: PublicKey) => boolean;
        getEventByID: func_GetEventByID;
        isAdmin: func_IsAdmin | undefined;
        getReactionsByEventID: func_GetReactionsByEventID;
    };
}

export class MessagePanel extends Component<MessagePanelProps> {
    render(props: MessagePanelProps) {
        let vnode = (
            <div class={`flex h-full w-full relative ${BackgroundColor_MessagePanel}`}>
                <div class={`flex flex-col h-full flex-1 overflow-hidden`}>
                    <div class={`flex-1`}></div>

                    <MessageList
                        key={props.messages[0]?.event.id} // this is not a 100% correct key which should be a stable hash of the whole array
                        myPublicKey={props.myPublicKey}
                        messages={props.messages}
                        emit={props.emit}
                        getters={props.getters}
                    />

                    <Editor
                        maxHeight="30vh"
                        emit={props.emit}
                        sub={props.eventSub}
                        placeholder=""
                        getters={{
                            ...props.getters,
                            getProfileByPublicKey: props.getters.getProfileByPublicKey,
                            getProfilesByText: props.getters.getProfilesByText,
                        }}
                        nip96
                    />
                </div>
            </div>
        );
        return vnode;
    }
}

export class MessagePanel_V0 extends Component<MessagePanelProps> {
    state = {
        replyToEventID: undefined,
    };

    handleReplyToEventIDChange = (eventID?: NoteID | string) => {
        this.setState({ replyToEventID: eventID });
    };

    render(props: MessagePanelProps) {
        let vnode = (
            <div class={`flex h-full w-full relative ${BackgroundColor_MessagePanel}`}>
                <div class={`flex flex-col h-full flex-1 overflow-hidden`}>
                    <div class={`flex-1`}></div>

                    <MessageList_V0
                        myPublicKey={props.myPublicKey}
                        messages={props.messages}
                        emit={props.emit}
                        getters={props.getters}
                    />

                    <Editor
                        maxHeight="30vh"
                        emit={props.emit}
                        sub={props.eventSub}
                        placeholder=""
                        getters={props.getters}
                    />
                </div>
            </div>
        );
        return vnode;
    }
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
    let show_name;
    if (author.hex == myPublicKey.hex) {
        show_name = "Me";
    } else if (author_profile) {
        show_name = author_profile.name || author_profile.display_name || author.bech32();
    } else {
        show_name = author.bech32();
    }

    return (
        <p class={`overflow-hidden flex`}>
            <p class={`text-[#FFFFFF] text-[0.9rem] truncate mobile:hidden`}>
                {show_name}
            </p>
            <p class={`text-[#A3A6AA] ml-4 text-[0.8rem] whitespace-nowrap mobile:ml-0 mobile:text-xs`}>
                {created_at.toLocaleString()}
            </p>
        </p>
    );
}

export type SyncEvent = {
    type: "SyncEvent";
    eventID: string;
};

export function ParseMessageContent(
    message: ChatMessage,
    emit: emitFunc<ViewUserDetail | OpenNote | SelectConversation | SyncEvent>,
    getters: {
        getProfileByPublicKey: func_GetProfileByPublicKey;
        getEventByID: func_GetEventByID;
    },
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
    for (const item of parsedContentItems) {
        if (item.type === "raw" || item.type === "tag") {
            vnode.push(item.text);
        } else if (item.type === "url") {
            if (urlIsImage(item.text)) {
                vnode.push(
                    <img
                        class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                        src={item.text}
                    />,
                );
            } else if (urlIsVideo(item.text)) {
                vnode.push(
                    <video
                        class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                        controls
                        src={item.text}
                    >
                    </video>,
                );
            } else {
                vnode.push(
                    <a target="_blank" class={`hover:underline text-[${LinkColor}]`} href={item.text}>
                        {item.text}
                    </a>,
                );
            }
        } else if (item.type === "npub" || item.type === "nprofile") {
            const pubkey = item.type == "npub" ? item.pubkey : item.nprofile.pubkey;
            const profile = getters.getProfileByPublicKey(pubkey);
            const name = profile?.profile.name || profile?.profile.display_name;
            vnode.push(
                <span
                    class="cursor-pointer text-[#C9CEF8] bg-[#3D446D] rounded hover:text-white hover:bg-[#5869EA] px-[0.1rem] hover:underline"
                    onClick={() =>
                        emit({
                            type: "ViewUserDetail",
                            pubkey: pubkey,
                        })}
                >
                    {name ? `@${name}` : pubkey.bech32()}
                </span>,
            );
        } else if (item.type === "note") {
            const event = getters.getEventByID(item.noteID);
            if (event == undefined || event.kind == NostrKind.DIRECT_MESSAGE) {
                vnode.push(item.text);
                emit({
                    type: "SyncEvent",
                    eventID: item.noteID.hex,
                });
            } else {
                const profile = getters.getProfileByPublicKey(event.publicKey);
                vnode.push(Card(event, profile?.profile, emit, event.publicKey));
            }
        } else if (item.type === "nevent") {
            const event = getters.getEventByID(NoteID.FromString(item.nevent.pointer.id));
            if (
                event == undefined || event.kind == NostrKind.DIRECT_MESSAGE
            ) {
                vnode.push(item.text);
                emit({
                    type: "SyncEvent",
                    eventID: item.nevent.pointer.id,
                });
            } else {
                const profile = getters.getProfileByPublicKey(event.publicKey);
                vnode.push(Card(event, profile ? profile.profile : undefined, emit, event.publicKey));
            }
        }
    }
    return vnode;
}

function Card(
    event: Parsed_Event,
    authorProfile: ProfileData | undefined,
    emit: emitFunc<ViewUserDetail | OpenNote>,
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
