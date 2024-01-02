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
import { GroupMessageController } from "../features/gm.ts";
import { ProfileSyncer, saveProfile } from "../features/profile.ts";
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
import { CreateGroup, CreateGroupChat, StartCreateGroupChat } from "./create-group.tsx";
import { StartInvite } from "./dm.tsx";
import { EditGroup, StartEditGroupChatProfile } from "./edit-group.tsx";
import { SaveProfile } from "./edit-profile.tsx";
import { EditorEvent, EditorModel, new_DM_EditorModel, SendMessage } from "./editor.tsx";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { InviteUsersToGroup } from "./invite-button.tsx";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { ChatMessage } from "./message.ts";
import { InstallPrompt, NavigationUpdate } from "./nav.tsx";
import { notify } from "./notification.ts";
import { RelayDetail } from "./relay-detail.tsx";
import { Search } from "./search.tsx";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { RelayConfigChange, ViewRelayDetail } from "./setting.tsx";
import { SignInEvent } from "./signIn.tsx";
import { TagSelected } from "./contact-tags.tsx";

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
    | CreateGroupChat
    | StartCreateGroupChat
    | StartEditGroupChatProfile
    | StartInvite
    | InviteUsersToGroup
    | ViewRelayDetail
    | TagSelected;

type BackToContactList = {
    type: "BackToContactList";
};
export type AppEventBus = EventBus<UI_Interaction_Event>;

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
    const events = eventBus.onChange();
    for await (const event of events) {
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

        //
        // Searchx
        //
        else if (event.type == "CancelPopOver") {
            model.search.isSearching = false;
        } else if (event.type == "StartSearch") {
            model.search.isSearching = true;
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
                children: <RelayDetail relayUrl={event.url} profileGetter={app.database} />,
            });
        } //
        //
        // Contacts
        //
        else if (event.type == "SelectConversation") {
            model.navigationModel.activeNav = "DM";
            model.search.isSearching = false;
            model.rightPanelModel = {
                show: false,
            };
            updateConversation(app.model, event.pubkey, event.isGroupChat);

            if (!model.dm.focusedContent.get(event.pubkey.hex)) {
                model.dm.focusedContent.set(event.pubkey.hex, event.pubkey);
            }
            app.popOverInputChan.put({ children: undefined });
            app.model.dm.isGroupMessage = event.isGroupChat;
            app.conversationLists.markRead(event.pubkey.hex, event.isGroupChat);
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
            handle_SendMessage(
                event,
                app.ctx,
                app.lamport,
                pool,
                app.model.dmEditors,
                app.model.gmEditors,
                app.database,
                app.groupChatController,
            ).then((res) => {
                if (res instanceof Error) {
                    console.error("update:SendMessage", res);
                }
            });
        } else if (event.type == "UpdateMessageFiles") {
            const editors = event.isGroupChat ? model.gmEditors : model.dmEditors;
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
            const editorMap = event.isGroupChat ? model.gmEditors : model.dmEditors;
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
            model.rightPanelModel = {
                show: false,
            };
        } //
        //
        // DM
        //
        else if (event.type == "InviteUsersToGroup") {
            for (const pubkey of event.usersPublicKey) {
                const invitationEvent = await app.groupChatController.createInvitation(
                    event.groupPublicKey,
                    pubkey,
                );
                if (invitationEvent instanceof Error) {
                    console.error(invitationEvent);
                    continue;
                }
                const err = await pool.sendEvent(invitationEvent);
                if (err instanceof Error) {
                    console.error(err);
                    continue;
                }
            }
        } else if (event.type == "ToggleRightPanel") {
            model.rightPanelModel.show = event.show;
        } else if (event.type == "ViewThread") {
            if (model.navigationModel.activeNav == "DM") {
                if (model.dm.currentEditor) {
                    model.dm.focusedContent.set(
                        model.dm.currentEditor.pubkey.hex,
                        event.root,
                    );
                }
            }
            model.rightPanelModel.show = true;
        } else if (event.type == "ViewUserDetail") {
            if (model.dm.currentEditor) {
                const currentFocus = model.dm.focusedContent.get(model.dm.currentEditor.pubkey.hex);
                if (
                    model.rightPanelModel.show == true &&
                    currentFocus instanceof PublicKey &&
                    currentFocus.hex == event.pubkey.hex &&
                    currentFocus.hex == model.dm.currentEditor.pubkey.hex
                ) {
                    model.rightPanelModel.show = false;
                } else {
                    model.dm.focusedContent.set(
                        model.dm.currentEditor.pubkey.hex,
                        event.pubkey,
                    );
                    model.rightPanelModel.show = true;
                }
            }
        } else if (event.type == "OpenNote") {
            open(`https://nostrapp.link/#${NoteID.FromHex(event.event.id).bech32()}?select=true`);
        } else if (event.type == "StartCreateGroupChat") {
            app.popOverInputChan.put({
                children: <CreateGroup emit={eventBus.emit} />,
            });
        } else if (event.type == "CreateGroupChat") {
            const profileData = event.profileData;

            const groupCreation = app.groupChatController.createGroupChat();
            const creationEvent = await app.groupChatController.encodeCreationToNostrEvent(groupCreation);
            if (creationEvent instanceof Error) {
                console.error(creationEvent);
                continue;
            }
            const err = await pool.sendEvent(creationEvent);
            if (err instanceof Error) {
                console.error(err);
                continue;
            }
            const profileEvent = await prepareNormalNostrEvent(
                groupCreation.groupKey,
                {
                    kind: NostrKind.META_DATA,
                    content: JSON.stringify(profileData),
                },
            );
            const err2 = pool.sendEvent(profileEvent);
            if (err2 instanceof Error) {
                console.error(err2);
                continue;
            }
            app.popOverInputChan.put({ children: undefined });
            app.profileSyncer.add(groupCreation.groupKey.publicKey.hex);
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
    isGroupChat: boolean,
) {
    const editorMap = isGroupChat ? model.gmEditors : model.dmEditors;
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
    profileSyncer: ProfileSyncer,
    lamport: LamportTime,
    convoLists: DM_List,
    groupController: GroupMessageController,
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

        profileSyncer.add(...changes_events.map((e) => e.pubkey));
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
                        false,
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
                    const err = await dmController.addEvent({
                        ...e,
                        kind: e.kind,
                    });
                    if (err instanceof Error) {
                        console.error(err);
                    }
                }
            } else if (e.kind == NostrKind.Group_Message) {
                {
                    const err = await groupController.addEvent({
                        ...e,
                        kind: e.kind,
                    });
                    if (err instanceof Error) {
                        console.error(err, e);
                        await database.remove(e.id);
                    }
                }
                {
                    const err = await dmController.addEvent({
                        ...e,
                        kind: e.kind,
                    });
                    if (err instanceof Error) {
                        console.error(err);
                        await database.remove(e.id);
                    }
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
                                    isGroupChat: false,
                                });
                            } else if (e.kind == NostrKind.Group_Message) {
                                const k = PublicKey.FromHex(e.pubkey);
                                if (k instanceof Error) {
                                    console.error(k);
                                    return;
                                }
                                emit({
                                    type: "SelectConversation",
                                    pubkey: k,
                                    isGroupChat: true,
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
    pool: ConnectionPool,
    dmEditors: Map<string, EditorModel>,
    gmEditors: Map<string, EditorModel>,
    db: Datebase_View,
    groupControl: GroupMessageController,
) {
    if (event.isGroupChat) {
        const textEvent = await groupControl.prepareGroupMessageEvent(
            event.pubkey,
            event.text,
        );
        if (textEvent instanceof Error) {
            return textEvent;
        }
        const err = await pool.sendEvent(textEvent);
        if (err instanceof Error) {
            return err;
        }

        for (const blob of event.files) {
            const imageEvent = await groupControl.prepareGroupMessageEvent(
                event.pubkey,
                blob,
            );
            if (imageEvent instanceof Error) {
                return imageEvent;
            }

            const err = await pool.sendEvent(imageEvent);
            if (err instanceof Error) {
                return err;
            }
        }
        const editor = gmEditors.get(event.pubkey.hex);
        if (editor) {
            editor.files = [];
            editor.text = "";
        }
    } else {
        const events = await sendDMandImages({
            sender: ctx,
            receiverPublicKey: event.pubkey,
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
            const editor = dmEditors.get(event.pubkey.hex);
            if (editor) {
                editor.files = [];
                editor.text = "";
            }
        }
        for (const eventSent of events) {
            const err = await db.addEvent(eventSent);
            if (err instanceof Error) {
                console.error(err);
            }
        }
    }
}
