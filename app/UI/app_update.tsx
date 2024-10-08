/** @jsx h */
import { h } from "preact";
import { Channel, closed, PutChannel, sleep } from "@blowater/csp";

import { Database_View } from "../database.ts";
import { emitFunc, EventBus } from "../event-bus.ts";
import { DirectedMessageController, sendDirectMessages } from "../features/dm.ts";
import { saveProfile } from "../features/profile.ts";
import {
    Encrypted_Event,
    getTags,
    Parsed_Event,
    PinConversation,
    prepareReplyEvent,
    Profile_Nostr_Event,
    Tag,
    UnpinConversation,
} from "../nostr.ts";
import { LamportTime } from "../time.ts";
import { App } from "./app.tsx";
import { Model, rememberActiveNav, rememberCurrentRelay } from "./app_model.ts";
import { PopOverInputChannel } from "./components/popover.tsx";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { ContactUpdate } from "./conversation-list.tsx";
import { StartInvite } from "./dm.tsx";
import { EditProfile, SaveProfile } from "./edit-profile.tsx";
import { EditorEvent, SendMessage } from "./editor.tsx";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";

import { DirectMessagePanelUpdate, SendReaction } from "./message-panel.tsx";
import { ChatMessage, parseContent } from "./message.ts";
import { InstallPrompt, NavigationModel, NavigationUpdate, SelectSpace, ShowProfileSetting } from "./nav.tsx";
import { notify } from "./notification.ts";
import { SpaceSetting } from "./relay-detail.tsx";
import { Search } from "./search.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { RelayConfigChange, ViewRecommendedRelaysList, ViewSpaceSettings } from "./setting.tsx";
import { SignInEvent } from "./sign-in.ts";
import { TagSelected } from "./contact-tags.tsx";
import { BlockUser, UnblockUser, UserDetail } from "./user-detail.tsx";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { HidePopOver } from "./components/popover.tsx";
import { Public_Model } from "./public-message-container.tsx";
import { SyncEvent } from "./message-panel.tsx";
import { SendingEventRejection, ToastChannel } from "./components/toast.tsx";

import { default_blowater_relay } from "./relay-config.ts";
import { forever } from "./_helper.ts";
import { DeleteEvent, func_GetEventByID } from "./message-list.tsx";
import { FilterContent } from "./filter.tsx";
import { CloseRightPanel } from "./components/right-panel.tsx";
import { RightPanelChannel } from "./components/right-panel.tsx";
import { ReplyToMessage } from "./message-list.tsx";
import { EditorSelectProfile } from "./editor.tsx";

import { HideModal, ModalInputChannel } from "./components/modal.tsx";
import {
    ConnectionPool,
    InMemoryAccountContext,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    NoteID,
    prepareDeletionEvent,
    prepareNostrEvent,
    prepareReactionEvent,
    PublicKey,
    SingleRelayConnection,
    uploadFile,
} from "@blowater/nostr-sdk";

export type UI_Interaction_Event =
    | SearchUpdate
    | ContactUpdate
    | EditorEvent
    | NavigationUpdate
    | DirectMessagePanelUpdate
    | BackToContactList
    | SaveProfile
    | PinConversation
    | UnpinConversation
    | SignInEvent
    | RelayConfigChange
    | StartInvite
    | ViewSpaceSettings
    | ViewRecommendedRelaysList
    | TagSelected
    | BlockUser
    | UnblockUser
    | SelectSpace
    | HidePopOver
    | HideModal
    | SyncEvent
    | FilterContent
    | CloseRightPanel
    | ReplyToMessage
    | EditorSelectProfile
    | DeleteEvent
    | SendReaction
    | ShowProfileSetting;

type BackToContactList = {
    type: "BackToContactList";
};
export type AppEventBus = EventBus<UI_Interaction_Event>;

export type UserBlocker = {
    blockUser(pubkey: PublicKey): void;
    unblockUser(pubkey: PublicKey): void;
    isUserBlocked(pubkey: PublicKey): boolean;
    getBlockedUsers(): Set<string>;
};

/////////////////////
// UI Interfaction //
/////////////////////
export function UI_Interaction_Update(args: {
    model: Model;
    eventBus: AppEventBus;
    dbView: Database_View;
    popOver: PopOverInputChannel;
    rightPanel: RightPanelChannel;
    modal: ModalInputChannel;
    lamport: LamportTime;
    installPrompt: InstallPrompt;
    toastInputChan: ToastChannel;
}): Channel<true> {
    const chan = new Channel<true>();
    forever(handle_update_event(chan, args));
    return chan;
}

const handle_update_event = async (chan: PutChannel<true>, args: {
    model: Model;
    eventBus: AppEventBus;
    dbView: Database_View;
    popOver: PopOverInputChannel;
    rightPanel: RightPanelChannel;
    modal: ModalInputChannel;
    lamport: LamportTime;
    installPrompt: InstallPrompt;
    toastInputChan: ToastChannel;
}) => {
    const { model, dbView, eventBus, installPrompt } = args;
    for await (const event of eventBus.onChange()) {
        console.log(event);
        if (event.type == "SignInEvent") {
            const ctx = event.ctx;
            console.log("sign in as", ctx.publicKey.bech32());
            const otherConfig = await OtherConfig.FromLocalStorage(
                ctx,
                args.lamport,
            );
            const pool = ctx instanceof InMemoryAccountContext
                ? new ConnectionPool({ signer: ctx, signer_v2: ctx }) // sign in by private key
                : new ConnectionPool({ signer: ctx }); // sign in by browser extension
            const app = await App.Start({
                database: dbView,
                model,
                ctx,
                eventBus,
                pool,
                popOverInputChan: args.popOver,
                rightPanelInputChan: args.rightPanel,
                modalInputChan: args.modal,
                otherConfig,
                lamport: args.lamport,
                installPrompt,
                toastInputChan: args.toastInputChan,
            });
            model.app = app;
            continue;
        }

        const app = model.app;
        if (app == undefined) { // if not signed in
            console.warn(event, "is not valid before signing");
            console.warn("This could not happen!");
            continue;
        }
        const pool = app.pool;
        let blowater_relay = pool.getRelay(default_blowater_relay);
        if (blowater_relay == undefined) {
            const relay = await pool.addRelayURL(default_blowater_relay);
            if (relay instanceof Error) {
                console.error(relay);
                continue;
            }
            blowater_relay = relay;
        }

        let current_relay = pool.getRelay(model.currentRelay);
        if (current_relay == undefined) {
            current_relay = blowater_relay;
            rememberCurrentRelay(default_blowater_relay);
        }

        // All events below are only valid after signning in
        if (event.type == "SelectSpace") {
            rememberCurrentRelay(event.spaceURL);
            model.currentRelay = event.spaceURL;
        } //
        // Searchx
        //
        else if (event.type == "HidePopOver") {
            app.popOverInputChan.put({
                children: undefined,
            });
        } else if (event.type == "StartSearch") {
            const search = (
                <Search
                    placeholder={`Search a user's public key or name (${
                        app.database.getUniqueProfileCount(model.currentRelay)
                    } profiles)`}
                    getProfileByPublicKey={app.database.getProfileByPublicKey}
                    getProfilesByText={app.database.getProfilesByText}
                    emit={eventBus.emit}
                />
            );
            args.popOver.put({ children: search });
        } else if (event.type == "HideModal") {
            await app.modalInputChan.put({
                children: undefined,
                onClose: event.onClose,
            });
        } //
        //
        // Setting
        //
        else if (event.type == "ViewSpaceSettings") {
            const relay = pool.getRelay(event.url);
            if (!relay) {
                console.error(event.url, "is not in the pool");
                continue;
            }
            let spaceUrl;
            try {
                spaceUrl = new URL(relay.url);
            } catch (e) {
                console.error(e);
                continue;
            }
            await app.modalInputChan.put({
                children: (
                    <SpaceSetting
                        emit={app.eventBus.emit}
                        getSpaceInformationChan={relay.unstable.getRelayInformationStream}
                        getMemberSet={app.database.getMemberSet}
                        spaceUrl={spaceUrl}
                        getProfileByPublicKey={app.database.getProfileByPublicKey}
                    />
                ),
            });
        } else if (event.type == "ViewRecommendedRelaysList") {
            app.popOverInputChan.put({
                children: (
                    <RelayRecommendList
                        relayConfig={app.relayConfig}
                        emit={eventBus.emit}
                        getRelayRecommendations={app.database.getRelayRecommendations}
                    />
                ),
            });
        } //
        //
        // Contacts
        //
        else if (event.type == "SelectConversation") {
            console.log("SelectConversation", event.pubkey.hex);
            rememberActiveNav("DM");
            model.navigationModel.activeNav = "DM";
            model.dm.currentConversation = event.pubkey;
            app.popOverInputChan.put({ children: undefined });
            app.conversationLists.markRead(event.pubkey);
        } else if (event.type == "BackToContactList") {
            model.dm.currentConversation = undefined;
        } else if (event.type == "PinConversation") {
            const err1 = await app.otherConfig.addPin(event.pubkey);
            if (err1 instanceof Error) {
                console.error(err1);
                continue;
            }
        } else if (event.type == "UnpinConversation") {
            const err1 = await app.otherConfig.removePin(event.pubkey);
            if (err1 instanceof Error) {
                console.error(err1);
                continue;
            }
        } //
        //
        // Editor
        //
        else if (event.type == "SendMessage") {
            if (event.text.length == 0) {
                app.toastInputChan.put(() => "the message is empty");
                continue;
            }
            handle_SendMessage(
                event,
                app.ctx,
                app.lamport,
                app.database,
                {
                    ...model,
                    current_relay,
                    blowater_relay,
                    getEventByID: app.database.getEventByID,
                },
            ).then((res) => {
                if (res instanceof Error) {
                    console.error(res);
                    app.toastInputChan.put(
                        SendingEventRejection(eventBus.emit, current_relay.url, res.message),
                    );
                } else {
                    chan.put(true);
                }
            });
        } else if (event.type == "UploadImage") {
            app.toastInputChan.put(() => "Uploading image...");
            const api_url = "https://nostr.build/api/v2/nip96/upload";
            const uploaded = await uploadFile(app.ctx, { api_url, file: event.file });
            app.toastInputChan.put(() => uploaded.message);
            event.callback(uploaded);
        } //
        //
        // Profile
        //
        else if (event.type == "ShowProfileSetting") {
            const profile_event = app.database.getProfileByPublicKey(app.ctx.publicKey, model.currentRelay);
            app.modalInputChan.put({
                children: (
                    <EditProfile
                        ctx={app.ctx}
                        profile={profile_event?.profile || {}}
                        emit={app.eventBus.emit}
                    />
                ),
            });
        } else if (event.type == "SaveProfile") {
            if (event.profile == undefined) {
                app.toastInputChan.put(() => "profile is empty");
            } else {
                saveProfile(
                    event.profile,
                    event.ctx,
                    current_relay,
                ).then((result: string | Error) => {
                    app.popOverInputChan.put({ children: undefined });
                    if (result instanceof Error) {
                        app.toastInputChan.put(
                            SendingEventRejection(eventBus.emit, current_relay.url, result.message),
                        );
                    } else {
                        app.toastInputChan.put(() => "profile has been updated");
                        app.modalInputChan.put({ children: undefined });
                    }
                });
            }
        } //
        //
        // Navigation
        //
        else if (event.type == "ChangeNavigation") {
            rememberActiveNav(event.id);
            model.navigationModel.activeNav = event.id;
        } else if (event.type == "CloseRightPanel") {
            app.rightPanelInputChan.put(undefined);
        } //
        //
        // Deletion
        //
        else if (event.type == "DeleteEvent") {
            const deletionEvent = await prepareDeletionEvent(
                app.ctx,
                "Request deletion",
                event.event,
            );
            if (deletionEvent instanceof Error) {
                app.toastInputChan.put(() => deletionEvent.message);
                continue;
            }
            current_relay.sendEvent(deletionEvent).then((res) => {
                if (res instanceof Error) {
                    app.toastInputChan.put(() => res.message);
                }
            });
        } //
        //
        // DM
        //
        else if (event.type == "ViewUserDetail") {
            sync_user_detail_data({ pool, pubkey: event.pubkey, database: app.database, profile_only: true });
            app.rightPanelInputChan.put(
                () => {
                    const profile_event = app.database.getProfileByPublicKey(
                        event.pubkey,
                        model.currentRelay,
                    );
                    return (
                        <UserDetail
                            targetUserProfile={profile_event?.profile ||
                                {}}
                            pubkey={event.pubkey}
                            emit={eventBus.emit}
                            blocked={app.conversationLists.isUserBlocked(event.pubkey)}
                        />
                    );
                },
            );
        } else if (event.type == "OpenNote") {
            open(`https://nostrapp.link/#${NoteID.FromHex(event.event.id).bech32()}?select=true`);
        } else if (event.type == "StartInvite") {
            app.popOverInputChan.put({
                children: <div></div>,
            });
        } else if (event.type == "RelayConfigChange") {
            (async () => {
                if (event.kind == "add") {
                    const relay = await app.relayConfig.add(event.url);
                    if (relay instanceof Error) {
                        console.error(relay);
                        const msg = relay.message;
                        app.toastInputChan.put(() => msg);
                    }
                } else {
                    const err = await app.relayConfig.remove(event.url);
                    if (err instanceof Error) {
                        app.toastInputChan.put(() => err.message);
                        return;
                    }
                    if (current_relay.url.toString() == event.url.toString()) {
                        model.currentRelay = default_blowater_relay;
                    }
                }
            })();
        } else if (event.type == "SendReaction") {
            const { event: targetEvent, content } = event;
            const reactionEvent = await prepareReactionEvent(app.ctx, { targetEvent, content });
            if (reactionEvent instanceof Error) {
                await app.toastInputChan.put(() => reactionEvent.message);
                continue;
            }
            current_relay.sendEvent(reactionEvent).then((res) => {
                if (res instanceof Error) {
                    app.toastInputChan.put(() => res.message);
                }
            });
        } else if (event.type == "ViewEventDetail") {
            const nostrEvent = event.message.event;
            const eventID = nostrEvent.id;
            const eventIDBech32 = NoteID.FromString(nostrEvent.id).bech32();
            const authorPubkey = event.message.author;

            const content = nostrEvent.content;
            const originalEventRaw = JSON.stringify(
                {
                    content: nostrEvent.content,
                    created_at: nostrEvent.created_at,
                    kind: nostrEvent.kind,
                    tags: nostrEvent.tags,
                    pubkey: nostrEvent.pubkey,
                    id: nostrEvent.id,
                    sig: nostrEvent.sig,
                },
                null,
                4,
            );
            const reactions = app.database.getReactionEvents(nostrEvent.id);

            const items: EventDetailItem[] = [
                {
                    title: "Event ID",
                    fields: [
                        eventID,
                        eventIDBech32,
                    ],
                },
                {
                    title: "Author",
                    fields: [
                        authorPubkey.hex,
                        authorPubkey.bech32(),
                    ],
                },
                {
                    title: "Relays",
                    fields: Array.from(app.database.getRelayRecord(nostrEvent.id)).map((r) => r.toString()),
                },
            ];
            if (nostrEvent.kind == NostrKind.DIRECT_MESSAGE) {
                items.push({
                    title: "Content",
                    fields: [
                        content,
                        event.message.content,
                        originalEventRaw,
                    ],
                });
            } else {
                items.push({
                    title: "Content",
                    fields: [
                        event.message.content,
                        originalEventRaw,
                    ],
                });
            }
            if (reactions.size > 0) {
                items.push({
                    title: "Reactions",
                    fields: Array.from(reactions).map((r) => {
                        return `${r.id}: ${r.content}`;
                    }),
                });
            }

            app.popOverInputChan.put({
                children: (
                    <EventDetail
                        items={items}
                    />
                ),
            });
        } else if (event.type == "BlockUser") {
            app.conversationLists.blockUser(event.pubkey);
        } else if (event.type == "UnblockUser") {
            app.conversationLists.unblockUser(event.pubkey);
        } else if (event.type == "SyncEvent") {
            for (const relay of app.pool.getRelays()) {
                relay.getEvent(event.eventID).then((nostr_event) => {
                    if (nostr_event instanceof Error) {
                        console.error(nostr_event);
                        return;
                    }
                    if (nostr_event) {
                        app.database.addEvent(nostr_event, relay.url);
                    }
                });
            }
            continue;
        } else if (event.type == "FilterContent") {
            const trimmed = event.content.trim();
            if (trimmed.length == 63) {
                const pubkey = PublicKey.FromBech32(trimmed);
                if (pubkey instanceof PublicKey) {
                    sync_user_detail_data({ pool, pubkey, database: app.database });
                }
            } else {
                continue;
            }
        } else {
            console.log(event, "is not handled");
            continue;
        }
        await chan.put(true);
    }
};

export type DirectMessageGetter = ChatMessagesGetter & {
    getDirectMessageStream(publicKey: string): Channel<ChatMessage>;
};

export type ChatMessagesGetter = {
    getChatMessages(publicKey: string): ChatMessage[];
    getMessageById(id: string): ChatMessage | undefined;
};

//////////////
// Database //
//////////////
export async function* Database_Update(
    ctx: NostrAccountContext,
    database: Database_View,
    model: Model,
    lamport: LamportTime,
    convoLists: DM_List,
    dmController: DirectedMessageController,
    emit: emitFunc<SelectConversation>,
    args: {
        otherConfig: OtherConfig;
    },
) {
    const changes = database.subscribe();
    while (true) {
        await sleep(333);
        await changes.ready();
        const changes_events: (Encrypted_Event | Profile_Nostr_Event | Parsed_Event)[] = [];
        while (true) {
            if (!changes.isReadyToPop()) {
                break;
            }
            const e = await changes.pop();
            if (e == closed) {
                console.error("unreachable: db changes channel should never close");
                break;
            }
            changes_events.push(e.event);
        }

        convoLists.addEvents(changes_events, true);
        for (let e of changes_events) {
            const t = getTags(e).lamport_timestamp;
            if (t) {
                lamport.set(t);
            }
            if (e.kind == NostrKind.META_DATA || e.kind == NostrKind.DIRECT_MESSAGE) {
                if (e.kind == NostrKind.DIRECT_MESSAGE) {
                    console.log("add event");
                    const err = await dmController.addEvent({
                        ...e,
                        kind: e.kind,
                    });
                    if (err instanceof Error) {
                        console.error(err);
                    }
                    console.log("add event done");
                }
            } else if (e.kind == NostrKind.Encrypted_Custom_App_Data) {
                console.log(e);
                const err = await args.otherConfig.addEvent(e);
                if (err instanceof Error) {
                    console.error(err);
                }
            }

            // notification should be moved to after domain objects
            {
                const author = database.getProfileByPublicKey(e.publicKey, model.currentRelay)?.profile;
                if (e.pubkey != ctx.publicKey.hex && e.parsedTags.p.includes(ctx.publicKey.hex)) {
                    notify(
                        author?.name ? author.name : "",
                        "new message",
                        author?.picture ? author.picture : "",
                        () => {
                            if (e.kind == NostrKind.DIRECT_MESSAGE) {
                                const k = PublicKey.FromHex(e.pubkey);
                                if (k instanceof Error) {
                                    console.error(k);
                                    return;
                                }
                                emit({
                                    type: "SelectConversation",
                                    pubkey: k,
                                });
                            } else if (e.kind == NostrKind.TEXT_NOTE) {
                                // todo
                                // open the default kind 1 app
                            } else {
                                // todo
                                // handle other types
                            }
                        },
                    );
                }
            }
        }
        yield model;
    }
}

export async function handle_SendMessage(
    ui_event: SendMessage,
    ctx: NostrAccountContext,
    lamport: LamportTime,
    db: Database_View,
    args: {
        navigationModel: NavigationModel;
        public: Public_Model;
        dm: {
            currentConversation: PublicKey | undefined;
        };
        blowater_relay: SingleRelayConnection;
        current_relay: SingleRelayConnection;
        getEventByID: func_GetEventByID;
    },
) {
    if (ui_event.text.length == 0) {
        return new Error("can't send empty message");
    }

    let replyToEvent: NostrEvent | undefined;
    if (ui_event.reply_to_event_id) {
        replyToEvent = args.getEventByID(ui_event.reply_to_event_id);
    }

    let events: NostrEvent[];
    if (args.navigationModel.activeNav == "DM") {
        const events_send = await sendDirectMessages({
            sender: ctx,
            receiverPublicKey: args.dm.currentConversation as PublicKey,
            message: ui_event.text,
            files: ui_event.files,
            lamport_timestamp: lamport.now(),
            eventSender: args.current_relay,
            targetEvent: replyToEvent,
        });
        if (events_send instanceof Error) {
            return events_send;
        }
        events = events_send;
    } else if (args.navigationModel.activeNav == "Public") {
        const tags = generateTags({
            content: ui_event.text,
            getEventByID: args.getEventByID,
            current_relay: args.current_relay.url,
        });
        const nostr_event = replyToEvent
            ? await prepareReplyEvent(
                ctx,
                {
                    targetEvent: replyToEvent,
                    tags: [...tags, ["client", "https://blowater.app"]],
                    content: ui_event.text,
                    currentRelay: args.current_relay.url,
                },
            )
            : await prepareNostrEvent(ctx, {
                content: ui_event.text,
                kind: NostrKind.TEXT_NOTE,
                tags: [...tags, ["client", "https://blowater.app"]],
            });
        if (nostr_event instanceof Error) {
            return nostr_event;
        }
        const err = await args.current_relay.sendEvent(nostr_event);
        if (err instanceof Error) {
            return err;
        }
        events = [nostr_event];
    } else {
        return new Error(`${args.navigationModel.activeNav} should not send messages`);
    }

    for (const eventSent of events) {
        const err = await db.addEvent(eventSent, undefined);
        if (err instanceof Error) {
            console.error(err);
        }
    }
}

export function generateTags(
    args: {
        content: string;
        getEventByID: func_GetEventByID;
        current_relay: URL;
    },
) {
    const eTags = new Map<string, [string, string]>();
    const pTags = new Set<string>();
    const parsedTextItems = parseContent(args.content);
    for (const item of parsedTextItems) {
        if (item.type === "nevent") {
            eTags.set(item.nevent.pointer.id, [item.nevent.pointer.relays?.[0] || "", "mention"]);
            if (item.nevent.pointer.pubkey) {
                pTags.add(item.nevent.pointer.pubkey.hex);
            }
        } else if (item.type === "npub") {
            pTags.add(item.pubkey.hex);
        } else if (item.type === "note") {
            eTags.set(item.noteID.hex, [args.current_relay.toString(), "mention"]);
            const event = args.getEventByID(item.noteID);
            if (event) {
                pTags.add(event.pubkey);
            }
        }
    }
    let tags: Tag[] = [];
    eTags.forEach((v, k) => {
        tags.push(["e", k, v[0], v[1]]);
    });
    pTags.forEach((v) => {
        tags.push(["p", v]);
    });
    return tags;
}

async function sync_user_detail_data(
    args: { pool: ConnectionPool; pubkey: PublicKey; database: Database_View; profile_only?: boolean },
) {
    const kinds = [NostrKind.META_DATA];
    if (!args.profile_only) {
        kinds.push(NostrKind.TEXT_NOTE, NostrKind.Long_Form);
    }
    const sub = await args.pool.newSub(args.pubkey.bech32(), {
        kinds,
        authors: [args.pubkey.hex],
    });
    if (sub instanceof Error) {
        console.error(sub);
        await args.pool.closeSub(args.pubkey.bech32());
        return;
    }
    for await (const msg of sub.chan) {
        if (msg.res.type == "EOSE") {
            break;
        } else if (msg.res.type == "EVENT") {
            await args.database.addEvent(msg.res.event, msg.url);
        }
    }
    await args.pool.closeSub(args.pubkey.bech32());
}
