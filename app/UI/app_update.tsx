/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { Channel, closed, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../../libs/nostr.ts/event.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { Datebase_View } from "../database.ts";
import { emitFunc, EventBus } from "../event-bus.ts";
import { DirectedMessageController, sendDMandImages } from "../features/dm.ts";
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
import { EditorEvent, EditorModel, new_DM_EditorModel, SendMessage } from "./editor.tsx";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { EventSender } from "../../libs/nostr.ts/relay.interface.ts";

import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { ChatMessage } from "./message.ts";
import { InstallPrompt, NavigationUpdate, SelectRelay } from "./nav.tsx";
import { notify } from "./notification.ts";
import { RelayInformationComponent } from "./relay-detail.tsx";
import { Search } from "./search.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { RelayConfigChange, ViewRecommendedRelaysList, ViewRelayDetail } from "./setting.tsx";
import { SignInEvent } from "./signIn.tsx";
import { TagSelected } from "./contact-tags.tsx";
import { BlockUser, UnblockUser } from "./user-detail.tsx";
import { RelayRecommendList } from "./relay-recommend-list.tsx";
import { HidePopOver } from "./components/popover.tsx";

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
    | StartEditGroupChatProfile
    | StartInvite
    | ViewRelayDetail
    | ViewRecommendedRelaysList
    | TagSelected
    | BlockUser
    | UnblockUser
    | SelectRelay
    | HidePopOver;

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
            model.navigationModel.activeNav = "DM";
            updateConversation(app.model, event.pubkey);

            if (!model.dm.focusedContent.get(event.pubkey.hex)) {
                model.dm.focusedContent.set(event.pubkey.hex, event.pubkey);
            }
            app.popOverInputChan.put({ children: undefined });
            app.conversationLists.markRead(event.pubkey);
        } else if (event.type == "BackToContactList") {
            model.dm.currentEditor = undefined;
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
                app.model.dmEditors,
                app.database,
            ).then((res) => {
                if (res instanceof Error) {
                    console.error("update:SendMessage", res);
                }
            });
        } else if (event.type == "UpdateMessageFiles") {
            const editors = model.dmEditors;
            const editor = editors.get(event.pubkey.hex);
            if (editor) {
                editor.files = event.files;
            } else {
                editors.set(event.pubkey.hex, {
                    files: event.files,
                    pubkey: event.pubkey,
                    text: "",
                });
            }
        } else if (event.type == "UpdateEditorText") {
            const editorMap = model.dmEditors;
            const editor = editorMap.get(event.pubkey.hex);
            if (editor) {
                editor.text = event.text;
            } else {
                editorMap.set(event.pubkey.hex, {
                    files: [],
                    text: event.text,
                    pubkey: event.pubkey,
                });
            }
            console.log(editor);
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
            model.navigationModel.activeNav = "Social";
            model.social.currentChannel = event.channel;
            model.social.relaySelectedChannel.set(model.currentRelay, event.channel);
            app.popOverInputChan.put({ children: undefined });
        } //
        //
        // DM
        //
        else if (event.type == "ViewUserDetail") {
            if (model.dm.currentEditor) {
                const currentFocus = model.dm.focusedContent.get(model.dm.currentEditor.pubkey.hex);
                if (
                    currentFocus instanceof PublicKey &&
                    currentFocus.hex == event.pubkey.hex &&
                    currentFocus.hex == model.dm.currentEditor.pubkey.hex
                ) {
                } else {
                    model.dm.focusedContent.set(
                        model.dm.currentEditor.pubkey.hex,
                        event.pubkey,
                    );
                }
            }
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

export function updateConversation(
    model: Model,
    targetPublicKey: PublicKey,
) {
    const editorMap = model.dmEditors;
    let editor = editorMap.get(targetPublicKey.hex);
    // If this conversation is new
    if (editor == undefined) {
        editor = {
            pubkey: targetPublicKey,
            files: [],
            text: "",
        };
        editorMap.set(targetPublicKey.hex, editor);
    }
    model.dm.currentEditor = editor;
}

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
                for (const contact of convoLists.convoSummaries.values()) {
                    const editor = model.dmEditors.get(contact.pubkey.hex);
                    if (editor == null) { // a stranger sends a message
                        const pubkey = PublicKey.FromHex(contact.pubkey.hex);
                        if (pubkey instanceof Error) {
                            throw pubkey; // impossible
                        }
                        model.dmEditors.set(
                            contact.pubkey.hex,
                            new_DM_EditorModel(
                                pubkey,
                            ),
                        );
                    }
                }

                if (model.dm.currentEditor) {
                    updateConversation(
                        model,
                        model.dm.currentEditor.pubkey,
                    );
                }

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
    pool: EventSender,
    dmEditors: Map<string, EditorModel>,
    db: Datebase_View,
) {
    switch (event.kind) {
        case NostrKind.TEXT_NOTE:
            return await handleSendTextNote(event, ctx, lamport, pool, dmEditors, db);
        case NostrKind.DIRECT_MESSAGE:
        case NostrKind.DIRECT_MESSAGE_V2:
            return await handleSendDirectMessage(event, ctx, lamport, pool, dmEditors, db);
        default:
            return new Error(`unsupported kind: ${event.kind}`);
    }
}

async function handleSendTextNote(
    event: SendMessage,
    ctx: NostrAccountContext,
    lamport: LamportTime,
    pool: EventSender,
    dmEditors: Map<string, EditorModel>,
    db: Datebase_View,
) {
    // ...
    console.log("handleSendTextNote");
}

async function handleSendDirectMessage(
    event: SendMessage,
    ctx: NostrAccountContext,
    lamport: LamportTime,
    pool: EventSender,
    dmEditors: Map<string, EditorModel>,
    db: Datebase_View,
) {
    const events = await sendDMandImages({
        sender: ctx,
        receiverPublicKey: event.editorID,
        message: event.text,
        files: event.files,
        lamport_timestamp: lamport.now(),
        pool,
        tags: [],
    });
    if (events instanceof Error) {
        return events;
    }
    {
        // clearing the editor before sending the message to relays
        // so that even if the sending is awaiting, the UI will clear
        const editor = dmEditors.get(event.editorID.hex);
        if (editor) {
            editor.files = [];
            editor.text = "";
        }
    }
    for (const eventSent of events) {
        const err = await db.addEvent(eventSent, undefined);
        if (err instanceof Error) {
            console.error(err);
        }
    }
}
