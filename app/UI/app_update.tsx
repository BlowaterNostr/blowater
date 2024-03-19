/** @jsx h */
import { ComponentChildren, h } from "https://esm.sh/preact@10.17.1";
import {
    Channel,
    closed,
    PopChannel,
    PutChannel,
    sleep,
} from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { Database_View } from "../database.ts";
import { emitFunc, EventBus } from "../event-bus.ts";
import { DirectedMessageController, sendDirectMessages } from "../features/dm.ts";
import { saveProfile } from "../features/profile.ts";
import {
    Encrypted_Event,
    getTags,
    Parsed_Event,
    PinConversation,
    Profile_Nostr_Event,
    UnpinConversation,
} from "../nostr.ts";
import { LamportTime } from "../time.ts";
import { App } from "./app.tsx";
import { Model } from "./app_model.ts";
import { PopOverInputChannel } from "./components/popover.tsx";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { ContactUpdate } from "./conversation-list.tsx";
import { StartInvite } from "./dm.tsx";
import { SaveProfile } from "./edit-profile.tsx";
import { EditorEvent, SendMessage } from "./editor.tsx";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";

import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { ChatMessage } from "./message.ts";
import { InstallPrompt, NavigationModel, NavigationUpdate, SelectRelay } from "./nav.tsx";
import { notify } from "./notification.ts";
import { RelayInformationComponent } from "./relay-detail.tsx";
import { Search } from "./search.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { RelayConfigChange, ViewRecommendedRelaysList, ViewRelayDetail } from "./setting.tsx";
import { SignInEvent } from "./sign-in.ts";
import { TagSelected } from "./contact-tags.tsx";
import { BlockUser, UnblockUser, UserDetail } from "./user-detail.tsx";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { HidePopOver } from "./components/popover.tsx";
import { Social_Model } from "./channel-container.tsx";
import { SyncEvent } from "./message-panel.tsx";
import { SendingEventRejection, ToastChannel } from "./components/toast.tsx";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { default_blowater_relay } from "./relay-config.ts";
import { forever } from "./_helper.ts";

export type UI_Interaction_Event =
    | SearchUpdate
    | ContactUpdate
    | EditorEvent
    | NavigationUpdate
    | DirectMessagePanelUpdate
    | BackToChannelList
    | BackToContactList
    | SaveProfile
    | PinConversation
    | UnpinConversation
    | SignInEvent
    | RelayConfigChange
    | StartInvite
    | ViewRelayDetail
    | ViewRecommendedRelaysList
    | TagSelected
    | BlockUser
    | UnblockUser
    | SelectRelay
    | HidePopOver
    | SyncEvent;

type BackToChannelList = {
    type: "BackToChannelList";
};
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
    pool: ConnectionPool;
    popOver: PopOverInputChannel;
    rightPanel: Channel<() => ComponentChildren>;
    newNostrEventChannel: Channel<NostrEvent>;
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
    pool: ConnectionPool;
    popOver: PopOverInputChannel;
    rightPanel: Channel<() => ComponentChildren>;
    newNostrEventChannel: Channel<NostrEvent>;
    lamport: LamportTime;
    installPrompt: InstallPrompt;
    toastInputChan: ToastChannel;
}) => {
    const { model, dbView, eventBus, pool, installPrompt } = args;
    for await (const event of eventBus.onChange()) {
        console.log(event);
        if (event.type == "SignInEvent") {
            const ctx = event.ctx;
            if (ctx) {
                console.log("sign in as", ctx.publicKey.bech32());
                const otherConfig = await OtherConfig.FromLocalStorage(
                    ctx,
                    args.newNostrEventChannel,
                    args.lamport,
                );
                const app = await App.Start({
                    database: dbView,
                    model,
                    ctx,
                    eventBus,
                    pool,
                    popOverInputChan: args.popOver,
                    rightPanelInputChan: args.rightPanel,
                    otherConfig,
                    lamport: args.lamport,
                    installPrompt,
                    toastInputChan: args.toastInputChan,
                });
                model.app = app;
            } else {
                console.error("failed to sign in");
            }
            continue;
        }

        const app = model.app;
        if (app == undefined) { // if not signed in
            console.warn(event, "is not valid before signing");
            console.warn("This could not happen!");
            continue;
        }

        const current_relay = pool.getRelay(model.currentRelay);
        if (current_relay == undefined) {
            console.error(Array.from(pool.getRelays()));
            continue;
        }

        const blowater_relay = pool.getRelay(default_blowater_relay);
        if (blowater_relay == undefined) {
            console.error(Array.from(pool.getRelays()));
            continue;
        }

        // All events below are only valid after signning in
        if (event.type == "SelectRelay") {
            model.currentRelay = event.relay.url;
        } //
        // Searchx
        //
        else if (event.type == "HidePopOver") {
            app.popOverInputChan.put({
                children: undefined,
            });
        } else if (event.type == "StartSearch") {
            app.database.getProfilesByText;
            const search = (
                <Search
                    placeholder={`Search a user's public key or name (${app.database.getUniqueProfileCount()} profiles)`}
                    profileGetter={app.database}
                    emit={eventBus.emit}
                />
            );
            args.popOver.put({ children: search });
        } //
        //
        // Setting
        //
        else if (event.type == "ViewRelayDetail") {
            app.popOverInputChan.put({
                children: (
                    <RelayInformationComponent
                        relayUrl={event.url}
                        profileGetter={app.database}
                        emit={app.eventBus.emit}
                    />
                ),
            });
        } else if (event.type == "ViewRecommendedRelaysList") {
            app.popOverInputChan.put({
                children: (
                    <RelayRecommendList
                        relayConfig={app.relayConfig}
                        emit={eventBus.emit}
                    />
                ),
            });
        } //
        //
        // Contacts
        //
        else if (event.type == "SelectConversation") {
            console.log("SelectConversation", event.pubkey.hex);
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
            handle_SendMessage(
                event,
                app.ctx,
                app.lamport,
                app.database,
                {
                    ...model,
                    current_relay,
                    blowater_relay,
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
        } else if (event.type == "UpdateMessageFiles") {
            console.log("to be implemented");
        } else if (event.type == "UpdateEditorText") {
            console.log("to be implemented");
        } //
        //
        // Profile
        //
        else if (event.type == "SaveProfile") {
            if (event.profile == undefined) {
                app.toastInputChan.put(() => "profile is empty");
            } else {
                saveProfile(
                    event.profile,
                    event.ctx,
                    current_relay,
                ).then((result) => {
                    app.popOverInputChan.put({ children: undefined });
                    if (result instanceof Error) {
                        app.toastInputChan.put(
                            SendingEventRejection(eventBus.emit, current_relay.url, result.message),
                        );
                    } else {
                        app.toastInputChan.put(() => "profile has been updated");
                    }
                });
            }
        } //
        //
        // Navigation
        //
        else if (event.type == "ChangeNavigation") {
            model.navigationModel.activeNav = event.id;
        } //
        //
        // Channel
        //
        else if (event.type == "SelectChannel") {
            model.social.relaySelectedChannel.set(model.currentRelay, event.channel);
            app.popOverInputChan.put({ children: undefined });
        } else if (event.type == "BackToChannelList") {
            model.social.relaySelectedChannel.delete(model.currentRelay);
            app.popOverInputChan.put({ children: undefined });
        } //
        // DM
        //
        else if (event.type == "ViewUserDetail") {
            app.rightPanelInputChan.put(
                () => {
                    return (
                        <UserDetail
                            targetUserProfile={app.database.getProfilesByPublicKey(event.pubkey)
                                ?.profile ||
                                {}}
                            pubkey={event.pubkey}
                            emit={eventBus.emit}
                            // dmList={app.conversationLists}
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
                    if (current_relay.url == event.url) {
                        model.currentRelay = default_blowater_relay;
                    }
                }
            })();
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
                    fields: Array.from(app.database.getRelayRecord(nostrEvent.id)),
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
                const author = database.getProfilesByPublicKey(e.publicKey)
                    ?.profile;
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
    event: SendMessage,
    ctx: NostrAccountContext,
    lamport: LamportTime,
    db: Database_View,
    args: {
        navigationModel: NavigationModel;
        social: Social_Model;
        dm: {
            currentConversation: PublicKey | undefined;
        };
        blowater_relay: SingleRelayConnection;
        current_relay: SingleRelayConnection;
    },
) {
    if (event.text.length == 0) {
        return new Error("can't send empty message");
    }

    let events: NostrEvent[];
    if (args.navigationModel.activeNav == "DM") {
        const events_send = await sendDirectMessages({
            sender: ctx,
            receiverPublicKey: args.dm.currentConversation as PublicKey,
            message: event.text,
            files: event.files,
            lamport_timestamp: lamport.now(),
            eventSender: args.blowater_relay,
            tags: [],
        });
        if (events_send instanceof Error) {
            return events_send;
        }
        for (const event of events_send) {
            const result = args.current_relay.sendEvent(event);
            if (result instanceof Error) {
                return result;
            }
        }
        events = events_send;
    } else if (args.navigationModel.activeNav == "Public") {
        const nostr_event = await prepareNormalNostrEvent(ctx, {
            content: event.text,
            kind: NostrKind.TEXT_NOTE,
            tags: event.tags || [],
        });
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
