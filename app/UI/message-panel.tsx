/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { RelayRecordGetter } from "../database.ts";
import { emitFunc, EventSubscriber } from "../event-bus.ts";
import { ProfileData } from "../features/profile.ts";
import { Parsed_Event, PinConversation, UnpinConversation } from "../nostr.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { Editor, EditorEvent } from "./editor.tsx";
import { EventSyncer } from "./event_syncer.ts";
import { AboutIcon } from "./icons/about-icon.tsx";
import { ChatMessage, parseContent, urlIsImage, urlIsVideo } from "./message.ts";
import { NoteCard } from "./note-card.tsx";
import { ProfileCard } from "./profile-card.tsx";
import { ProfileGetter } from "./search.tsx";
import { SelectConversation } from "./search_model.ts";
import {
    BackgroundColor_MessagePanel,
    DividerBackgroundColor,
    ErrorColor,
    LinkColor,
} from "./style/colors.ts";
import { BlockUser, UnblockUser } from "./user-detail.tsx";
import { func_GetEventByID, MessageList } from "./message-list.tsx";

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

export type ViewUserDetail = {
    type: "ViewUserDetail";
    pubkey: PublicKey;
};

interface DirectMessagePanelProps {
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
    >;
    eventSub: EventSubscriber<UI_Interaction_Event>;
    messages: ChatMessage[];
    getters: {
        profileGetter: ProfileGetter;
        relayRecordGetter: RelayRecordGetter;
        isUserBlocked: (pubkey: PublicKey) => boolean;
        getEventByID: func_GetEventByID;
    };
}

export class MessagePanel extends Component<DirectMessagePanelProps> {
    render(props: DirectMessagePanelProps) {
        let vnode = (
            <div class={`flex h-full w-full relative ${BackgroundColor_MessagePanel}`}>
                <div class={`flex flex-col h-full flex-1 overflow-hidden`}>
                    <div class={`flex-1`}></div>

                    <MessageList
                        myPublicKey={props.myPublicKey}
                        messages={props.messages}
                        emit={props.emit}
                        getters={props.getters}
                    />

                    <Editor
                        maxHeight="30vh"
                        emit={props.emit}
                        placeholder=""
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
    let show = author.bech32();
    if (author.hex == myPublicKey.hex) {
        show = "Me";
    } else if (author_profile?.name) {
        show = author_profile.name;
    }

    return (
        <p class={`overflow-hidden flex`}>
            <p class={`text-[#FFFFFF] text-[0.9rem] truncate mobile:hidden`}>
                {show}
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
    authorProfile: ProfileData | undefined,
    emit: emitFunc<ViewUserDetail | OpenNote | SelectConversation | SyncEvent>,
    getters: {
        profileGetter: ProfileGetter;
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
    let start = 0;
    for (const item of parsedContentItems) {
        vnode.push(message.content.slice(start, item.start));
        const itemStr = message.content.slice(item.start, item.end + 1);
        if (item.type == "url") {
            if (urlIsImage(itemStr)) {
                vnode.push(
                    <img
                        class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                        src={itemStr}
                    />,
                );
            } else if (urlIsVideo(itemStr)) {
                vnode.push(
                    <video
                        class={`w-96 p-1 rounded-lg border-2 border-[${DividerBackgroundColor}]`}
                        controls
                        src={itemStr}
                    >
                    </video>,
                );
            } else {
                vnode.push(
                    <a target="_blank" class={`hover:underline text-[${LinkColor}]`} href={itemStr}>
                        {itemStr}
                    </a>,
                );
            }
        } else if (item.type == "npub") {
            if (authorProfile) {
                const profile = getters.profileGetter.getProfilesByPublicKey(item.pubkey);
                vnode.push(
                    <ProfileCard
                        profileData={profile ? profile.profile : undefined}
                        publicKey={item.pubkey}
                        emit={emit}
                    />,
                );
            } else {
                // profilesSyncer.add(item.pubkey.hex);
                // todo: what to do?
                // maybe signal an event to the bus
                // or maybe it's not necessary because now we
                // are syncing all kind 0s
            }
            vnode.push(
                <ProfileCard publicKey={item.pubkey} emit={emit} />,
            );
        } else if (item.type == "note") {
            const event = getters.getEventByID(item.noteID);
            if (event == undefined || event.kind == NostrKind.DIRECT_MESSAGE) {
                vnode.push(itemStr);
                emit({
                    type: "SyncEvent",
                    eventID: item.noteID.hex,
                });
            } else {
                const profile = getters.profileGetter.getProfilesByPublicKey(event.publicKey);
                vnode.push(Card(event, profile?.profile, emit, event.publicKey));
            }
        } else if (item.type == "nevent") {
            const event = getters.getEventByID(NoteID.FromString(item.event.pointer.id));
            if (
                event == undefined || event.kind == NostrKind.DIRECT_MESSAGE
            ) {
                vnode.push(itemStr);
                emit({
                    type: "SyncEvent",
                    eventID: item.event.pointer.id,
                });
            } else {
                const profile = getters.profileGetter.getProfilesByPublicKey(event.publicKey);
                vnode.push(Card(event, profile ? profile.profile : undefined, emit, event.publicKey));
            }
        }

        start = item.end + 1;
    }
    vnode.push(message.content.slice(start));

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

function ReSent() {
    const styles = {
        container: `flex items-center cursor-pointer`,
        icon: `w-2 h-2 text-[${ErrorColor}] fill-current mr-2`,
        text: `text-xs text-[${ErrorColor}]`,
    };

    return (
        <div class={styles.container}>
            <AboutIcon class={styles.icon} />
            <p class={styles.text}>Failed to send message</p>
        </div>
    );
}
