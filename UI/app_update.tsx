/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { ProfileSyncer, saveProfile } from "../features/profile.ts";

import { App } from "./app.tsx";
import {
    ConversationLists,
    ConversationSummary,
    getConversationSummaryFromPublicKey,
} from "./conversation-list.ts";

import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database_Contextual_View } from "../database.ts";
import { convertEventsToChatMessages } from "./dm.ts";

import { sendDMandImages } from "../features/dm.ts";
import { notify } from "./notification.ts";
import { emitFunc, EventBus } from "../event-bus.ts";
import { ContactUpdate } from "./conversation-list.tsx";
import { MyProfileUpdate } from "./edit-profile.tsx";
import { EditorEvent, EditorModel, new_DM_EditorModel, SendMessage } from "./editor.tsx";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { NavigationUpdate } from "./nav.tsx";
import { Model } from "./app_model.ts";
import { SearchUpdate, SelectConversation } from "./search_model.ts";
import { fromEvents, LamportTime } from "../time.ts";
import { SignInEvent, signInWithExtension, signInWithPrivateKey } from "./signIn.tsx";
import {
    computeThreads,
    DirectedMessage_Event,
    Encrypted_Event,
    getTags,
    PinConversation,
    Profile_Nostr_Event,
    Text_Note_Event,
    UnpinConversation,
} from "../nostr.ts";
import { StartInvite } from "./dm.tsx";
import { DexieDatabase } from "./dexie-db.ts";
import { RelayConfigChange } from "./setting.tsx";
import { PopOverInputChannel } from "./components/popover.tsx";
import { Search } from "./search.tsx";
import { NoteID } from "../lib/nostr-ts/nip19.ts";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { CreateGroup, CreateGroupChat, StartCreateGroupChat } from "./create-group.tsx";
import { prepareEncryptedNostrEvent, prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { OtherConfig } from "./config-other.ts";
import { EditGroup, EditGroupChatProfile, StartEditGroupChatProfile } from "./edit-group.tsx";
import { GroupChatController, GroupMessage } from "../group-chat.ts";
import { ChatMessage } from "./message.ts";

export type UI_Interaction_Event =
    | SearchUpdate
    | ContactUpdate
    | EditorEvent
    | NavigationUpdate
    | DirectMessagePanelUpdate
    | BackToContactList
    | MyProfileUpdate
    | PinConversation
    | UnpinConversation
    | SignInEvent
    | RelayConfigChange
    | CreateGroupChat
    | StartCreateGroupChat
    | EditGroupChatProfile
    | StartEditGroupChatProfile
    | StartInvite;

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
    dexieDB: DexieDatabase;
    pool: ConnectionPool;
    popOver: PopOverInputChannel;
}) {
    const { model, eventBus, dexieDB, pool } = args;
    const events = eventBus.onChange();
    for await (const event of events) {
        console.log(event);
        switch (event.type) {
            case "editSignInPrivateKey":
                model.signIn.privateKey = event.privateKey;
                yield model;
                continue;
                break;
            case "signin":
                let ctx;
                if (event.privateKey) {
                    ctx = signInWithPrivateKey(event.privateKey);
                } else {
                    const ctx2 = await signInWithExtension();
                    console.log(ctx2);
                    if (typeof ctx2 == "string") {
                        model.signIn.warningString = ctx2;
                    } else if (ctx2 instanceof Error) {
                        model.signIn.warningString = ctx2.message;
                    } else {
                        ctx = ctx2;
                    }
                }
                if (ctx) {
                    console.log("sign in as", ctx.publicKey.bech32());
                    const dbView = await Database_Contextual_View.New(dexieDB, ctx);
                    if (dbView instanceof Error) {
                        throw dbView;
                    }
                    const lamport = fromEvents(dbView.events);
                    const otherConfig = await OtherConfig.FromLocalStorage(ctx);
                    const app = new App(
                        dbView,
                        lamport,
                        model,
                        ctx,
                        eventBus,
                        pool,
                        args.popOver,
                        otherConfig,
                    );
                    await app.initApp();
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
        // Contacts
        //
        else if (event.type == "SelectConversation") {
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
        } else if (event.type == "BackToContactList") {
            model.dm.currentEditor = undefined;
        } else if (event.type == "PinConversation") {
            app.otherConfig.addPin(event.pubkey);
            let err = await app.otherConfig.saveToLocalStorage(app.ctx);
            if (err instanceof Error) {
                console.error(err);
                continue;
            }
            err = await app.otherConfig.saveToRelay(pool, app.ctx);
            if (err instanceof Error) {
                console.error(err);
                continue;
            }
        } else if (event.type == "UnpinConversation") {
            app.otherConfig.removePin(event.pubkey);
            let err = await app.otherConfig.saveToLocalStorage(app.ctx);
            if (err instanceof Error) {
                console.error(err);
                continue;
            }
            err = await app.otherConfig.saveToRelay(pool, app.ctx);
            if (err instanceof Error) {
                console.error(err);
                continue;
            }
        } //
        //
        // Editor
        //
        else if (event.type == "SendMessage") {
            const err = await handle_SendMessage(
                event,
                app.ctx,
                app.lamport,
                pool,
                app.model.editors,
                app.database,
                app.groupChatController,
            );
            if (err instanceof Error) {
                console.error("update:SendMessage", err);
                continue; // todo: global error toast
            }
        } else if (event.type == "UpdateMessageFiles") {
            const editor = model.editors.get(event.pubkey.hex);
            if (editor) {
                editor.files = event.files;
            } else {
                console.log(event);
                throw new Error("impossible state");
            }
        } else if (event.type == "UpdateEditorText") {
            const editorMap = event.isGroupChat ? model.gmEditors : model.editors;
            console.log(editorMap);
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
        // MyProfile
        //
        else if (event.type == "EditMyProfile") {
            model.myProfile = Object.assign(model.myProfile || {}, event.profile);
        } else if (event.type == "SaveMyProfile") {
            InsertNewProfileField(app.model);
            await saveProfile(
                event.profile,
                app.ctx,
                pool,
            );
        } else if (event.type == "EditNewProfileFieldKey") {
            model.newProfileField.key = event.key;
        } else if (event.type == "EditNewProfileFieldValue") {
            model.newProfileField.value = event.value;
        } else if (event.type == "InsertNewProfileField") {
            InsertNewProfileField(app.model);
        } //
        //
        // Navigation
        //
        else if (event.type == "ChangeNavigation") {
            model.navigationModel.activeNav = event.index;
            model.rightPanelModel = {
                show: false,
            };
        } //
        //
        // DM
        //
        else if (event.type == "ToggleRightPanel") {
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
            if (
                model.navigationModel.activeNav == "DM"
            ) {
                if (model.dm.currentEditor) {
                    model.dm.focusedContent.set(
                        model.dm.currentEditor.pubkey.hex,
                        event.pubkey,
                    );
                }
            }
            model.rightPanelModel.show = true;
        } else if (event.type == "ViewNoteThread") {
            let root: NostrEvent = event.event;
            if (event.event.parsedTags.root && event.event.parsedTags.root) {
                const res = app.eventSyncer.syncEvent(NoteID.FromHex(event.event.parsedTags.root[0]));
                if (res instanceof Promise) {
                    continue;
                }
                root = res;
            } else if (event.event.parsedTags.e && event.event.parsedTags.e.length) {
                const res = app.eventSyncer.syncEvent(NoteID.FromHex(event.event.parsedTags.e[0]));
                if (res instanceof Promise) {
                    continue;
                }
                root = res;
            }

            if (root.kind == NostrKind.DIRECT_MESSAGE) {
                const myPubkey = app.ctx.publicKey.hex;
                if (root.pubkey != myPubkey && !getTags(root).p.includes(myPubkey)) {
                    continue; // if no conversation
                }
                updateConversation(model, PublicKey.FromHex(root.pubkey) as PublicKey, false);
                if (model.dm.currentEditor) {
                    model.dm.focusedContent.set(
                        model.dm.currentEditor.pubkey.hex,
                        root,
                    );
                }
            }
            model.rightPanelModel.show = true;
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
                NostrKind.META_DATA,
                [],
                JSON.stringify(profileData),
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
                        publicKey={event.publicKey}
                        conversationLists={app.conversationLists}
                    />
                ),
            });
        } else if (event.type == "EditGroupChatProfile") {
            const profileData = event.profileData;
            const publicKey = event.publicKey;
            const groupCtx = app.groupChatController.getGroupAdminCtx(publicKey);
            if (!groupCtx) {
                console.error(`No permission to modify gorup ${publicKey}'s profile`);
                continue;
            }
            const profileEvent = await prepareNormalNostrEvent(
                groupCtx,
                NostrKind.META_DATA,
                [],
                JSON.stringify(profileData),
            );
            const err = pool.sendEvent(profileEvent);
            if (err instanceof Error) {
                console.error(err);
                continue;
            }
            app.popOverInputChan.put({ children: undefined });
        } else if (event.type == "StartInvite") {
            app.popOverInputChan.put({
                children: <div></div>,
            });
        } else if (event.type == "RelayConfigChange") {
            const e = await app.relayConfig.toNostrEvent(app.ctx);
            if (e instanceof Error) {
                throw e; // impossible
            }
            pool.sendEvent(e);
            app.relayConfig.saveToLocalStorage(app.ctx);
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
                    title: "Content",
                    fields: [
                        content,
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

export type DirectMessageGetter = {
    getDirectMessages(publicKey: string): DirectedMessage_Event[];
};

export type GroupMessageGetter = {
    getGroupMessages(publicKey: string): ChatMessage[];
};

export function getConversationMessages(args: {
    targetPubkey: string;
    isGroupChat: boolean;
    dmGetter: DirectMessageGetter;
    gmGetter: GroupMessageGetter;
}): ChatMessage[] {
    const { targetPubkey } = args;
    if (args.isGroupChat) {
        return args.gmGetter.getGroupMessages(args.targetPubkey);
    }

    let events = args.dmGetter.getDirectMessages(targetPubkey);
    if (events == undefined) {
        events = [];
    }

    const messages = convertEventsToChatMessages(events);
    if (messages.length > 0) {
        messages.sort((m1, m2) => {
            if (m1.lamport && m2.lamport && m1.lamport != m2.lamport) {
                return m1.lamport - m2.lamport;
            }
            return m1.created_at.getTime() - m2.created_at.getTime();
        });
    }
    return messages;
}

export function updateConversation(
    model: Model,
    targetPublicKey: PublicKey,
    isGroupChat: boolean,
) {
    const editorMap = isGroupChat ? model.gmEditors : model.editors;
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
    database: Database_Contextual_View,
    model: Model,
    profileSyncer: ProfileSyncer,
    lamport: LamportTime,
    convoLists: ConversationLists,
    emit: emitFunc<SelectConversation>,
) {
    const changes = database.subscribe();
    while (true) {
        await csp.sleep(333);
        await changes.ready();
        const t = Date.now();
        const changes_events: (Text_Note_Event | Encrypted_Event | Profile_Nostr_Event)[] = [];
        while (true) {
            if (!changes.isReadyToPop()) {
                break;
            }
            const e = await changes.pop();
            if (e == csp.closed) {
                console.error("unreachable: db changes channel should never close");
                break;
            }
            if (e == null) {
                continue;
            }
            changes_events.push(e);
        }

        let hasKind_1 = false;
        profileSyncer.add(...changes_events.map((e) => e.pubkey));
        convoLists.addEvents(changes_events);
        for (let e of changes_events) {
            const t = getTags(e).lamport_timestamp;
            if (t) {
                lamport.set(t);
            }
            if (e.kind == NostrKind.META_DATA || e.kind == NostrKind.DIRECT_MESSAGE) {
                for (const contact of convoLists.convoSummaries.values()) {
                    const editor = model.editors.get(contact.pubkey.hex);
                    if (editor == null) { // a stranger sends a message
                        const pubkey = PublicKey.FromHex(contact.pubkey.hex);
                        if (pubkey instanceof Error) {
                            throw pubkey; // impossible
                        }
                        model.editors.set(
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
                    const pubkey = PublicKey.FromHex(e.pubkey);
                    if (pubkey instanceof Error) {
                        console.error(pubkey);
                        continue;
                    }
                }
            } else if (e.kind == NostrKind.TEXT_NOTE) {
                hasKind_1 = true;
            }

            // notification
            {
                const author = getConversationSummaryFromPublicKey(e.publicKey, convoLists.convoSummaries)
                    ?.profile;
                if (e.pubkey != ctx.publicKey.hex && e.parsedTags.p.includes(ctx.publicKey.hex)) {
                    notify(
                        author?.profile.name ? author.profile.name : "",
                        "new message",
                        author?.profile.picture ? author.profile.picture : "",
                        () => {
                            const k = PublicKey.FromHex(e.pubkey);
                            if (k instanceof Error) {
                                console.error(k);
                                return;
                            }
                            emit({
                                type: "SelectConversation",
                                pubkey: k,
                                isGroupChat: false, // todo
                            });
                        },
                    );
                }
            }
        }
        // if (hasKind_1) {
        //     console.log("Database_Update: getSocialPosts");
        //     model.social.threads = getSocialPosts(database, convoLists.convoSummaries);
        // }
        yield model;
    }
}

function InsertNewProfileField(model: Model) {
    if (model.newProfileField.key && model.newProfileField.value) {
        model.myProfile = Object.assign(model.myProfile || {}, {
            [model.newProfileField.key]: model.newProfileField.value,
        });
        model.newProfileField = {
            key: "",
            value: "",
        };
    }
}

export async function handle_SendMessage(
    event: SendMessage,
    ctx: NostrAccountContext,
    lamport: LamportTime,
    pool: ConnectionPool,
    dmEditors: Map<string, EditorModel>,
    db: Database_Contextual_View,
    groupControl: GroupChatController,
) {
    if (event.isGroupChat) {
        const groupCtx = groupControl.getGroupChatCtx(event.pubkey);
        if (groupCtx == undefined) {
            return new Error(`group ctx for ${event.pubkey.bech32()} is empty`);
        }
        const nostrEvent = await prepareEncryptedNostrEvent(ctx, {
            content: JSON.stringify({
                type: "gm_message",
                text: event.text,
            }),
            kind: NostrKind.Group_Message,
            tags: [
                ["p", groupCtx.publicKey.hex],
            ],
            encryptKey: groupCtx.publicKey,
        });
        if (nostrEvent instanceof Error) {
            return nostrEvent;
        }
        const err = await pool.sendEvent(nostrEvent);
        if (err instanceof Error) {
            return err;
        }
        const err2 = await db.addEvent(nostrEvent);
        if (err2 instanceof Error) {
            console.error(err);
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
        for (const eventSent of events) {
            const err = await db.addEvent(eventSent);
            if (err instanceof Error) {
                console.error(err);
            }
        }
    }
    // clear the editor model
    const editor = dmEditors.get(event.id);
    if (editor) {
        editor.files = [];
        editor.text = "";
    }
}
