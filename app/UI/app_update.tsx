/** @jsx h */
import { ComponentChildren, h } from "https://esm.sh/preact@10.17.1";
import { Channel, closed, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { Datebase_View } from "../database.ts";
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
import { EditGroup, StartEditGroupChatProfile } from "./edit-group.tsx";
import { SaveProfile } from "./edit-profile.tsx";
import { EditorEvent, SendMessage } from "./editor.tsx";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { EventSender } from "../../libs/nostr.ts/relay.interface.ts";

import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { ChatMessage } from "./message.ts";
import { InstallPrompt, NavigationModel, NavigationUpdate, SelectRelay } from "./nav.tsx";
import { notify } from "./notification.ts";
import { RelayInformationComponent } from "./relay-detail.tsx";
import { Search } from "./search.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { RelayConfigChange, ViewRecommendedRelaysList, ViewRelayDetail } from "./setting.tsx";
import { SignInEvent } from "./signIn.tsx";
import { TagSelected } from "./contact-tags.tsx";
import { BlockUser, UnblockUser, UserDetail } from "./user-detail.tsx";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { HidePopOver } from "./components/popover.tsx";
import { Social_Model } from "./channel-container.tsx";
import { DM_Model } from "./dm.tsx";

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
    | StartEditGroupChatProfile
    | StartInvite
    | ViewRelayDetail
    | ViewRecommendedRelaysList
    | TagSelected
    | BlockUser
    | UnblockUser
    | SelectRelay
    | HidePopOver;

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
export async function* UI_Interaction_Update(args: {
    model: Model;
    eventBus: AppEventBus;
    dbView: Datebase_View;
    pool: ConnectionPool;
    popOver: PopOverInputChannel;
    rightPanel: Channel<() => ComponentChildren>;
    newNostrEventChannel: Channel<NostrEvent>;
    lamport: LamportTime;
    installPrompt: InstallPrompt;
}) {
    const { model, dbView, eventBus, pool, installPrompt } = args;
    for await (const event of eventBus.onChange()) {
        console.log(event);
        switch (event.type) {
            case "SignInEvent":
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
                    });
                    model.app = app;
                } else {
                    console.error("failed to sign in");
                }
                yield model;
                continue;
        }

        const app = model.app;
        if (app == undefined) { // if not signed in
            console.warn(event, "is not valid before signing");
            console.warn("This could not happen!");
            continue;
        } // All events below are only valid after signning in
        //
        else if (event.type == "SelectRelay") {
            model.currentRelay = event.relay.url;
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
                    placeholder={"Search a user's public key or name"}
                    db={app.database}
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
                children: <RelayInformationComponent relayUrl={event.url} profileGetter={app.database} />,
            });
        } else if (event.type == "ViewRecommendedRelaysList") {
            app.popOverInputChan.put({
                children: (
                    <RelayRecommendList
                        relayConfig={event.relayConfig}
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
            const currentRelay = pool.getRelay(model.currentRelay);
            if (!currentRelay) {
                console.error(`currentRelay is not found: ${model.currentRelay}`);
                continue;
            }
            handle_SendMessage(
                event,
                app.ctx,
                app.lamport,
                currentRelay,
                app.database,
                model,
            ).then((res) => {
                if (res instanceof Error) {
                    console.error("update:SendMessage", res);
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
            await saveProfile(
                event.profile,
                event.ctx,
                pool,
            );
            app.popOverInputChan.put({ children: undefined });
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
            if (!model.currentRelay) {
                console.error("currentRelay is not set");
                continue;
            }
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
                            targetUserProfile={app.database.getProfilesByPublicKey(event.pubkey)?.profile ||
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
        } else if (event.type == "StartEditGroupChatProfile") {
            app.popOverInputChan.put({
                children: (
                    <EditGroup
                        emit={eventBus.emit}
                        ctx={event.ctx}
                        profileGetter={app.database}
                    />
                ),
            });
        } else if (event.type == "StartInvite") {
            app.popOverInputChan.put({
                children: <div></div>,
            });
        } else if (event.type == "RelayConfigChange") {
            const e = await prepareEncryptedNostrEvent(app.ctx, {
                kind: NostrKind.Custom_App_Data,
                encryptKey: app.ctx.publicKey,
                content: JSON.stringify(event),
                tags: [],
            });
            if (e instanceof Error) {
                console.error(e);
                continue;
            }
            {
                const err = await pool.sendEvent(e);
                if (err instanceof Error) {
                    console.error(err);
                    continue;
                }
            }
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
                {
                    title: "Content",
                    fields: [
                        content,
                        event.message.content,
                        originalEventRaw,
                    ],
                },
            ];
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
        }
        yield model;
    }
}

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
    database: Datebase_View,
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
            changes_events.push(e);
        }

        convoLists.addEvents(changes_events, true);
        for (let e of changes_events) {
            const t = getTags(e).lamport_timestamp;
            if (t) {
                lamport.set(t);
            }
            if (e.kind == NostrKind.META_DATA || e.kind == NostrKind.DIRECT_MESSAGE) {
                if (e.kind == NostrKind.META_DATA) {
                    // my profile update
                    if (ctx && e.pubkey == ctx.publicKey.hex) {
                        const newProfile = database.getProfilesByPublicKey(ctx.publicKey);
                        if (newProfile == undefined) {
                            throw new Error("impossible");
                        }
                        model.myProfile = newProfile.profile;
                    }
                } else if (e.kind == NostrKind.DIRECT_MESSAGE) {
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
    eventSender: EventSender,
    db: Datebase_View,
    args: {
        navigationModel: NavigationModel;
        social: Social_Model;
        dm: {
            currentConversation: PublicKey | undefined;
        };
    },
) {
    let events;
    if (args.navigationModel.activeNav == "DM") {
        events = await sendDirectMessages({
            sender: ctx,
            receiverPublicKey: args.dm.currentConversation as PublicKey,
            message: event.text,
            files: event.files,
            lamport_timestamp: lamport.now(),
            eventSender,
            tags: [],
        });
        if (events instanceof Error) {
            return events;
        }
    } else if (args.navigationModel.activeNav == "Social") {
        const nostr_event = await prepareNormalNostrEvent(ctx, {
            content: event.text,
            kind: NostrKind.TEXT_NOTE,
        });
        const err = await eventSender.sendEvent(nostr_event);
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
