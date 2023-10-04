/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { getProfileEvent, getProfilesByName, ProfileSyncer, saveProfile } from "../features/profile.ts";

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
import { DM_EditorModel, EditorEvent, new_DM_EditorModel, SendMessage } from "./editor.tsx";
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
import { MessageThread } from "./dm.tsx";
import { DexieDatabase } from "./dexie-db.ts";
import { RelayConfigChange } from "./setting.tsx";
import { PopOverInputChannel } from "./components/popover.tsx";
import { Search } from "./search.tsx";
import { NoteID } from "../lib/nostr-ts/nip19.ts";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";
import { CreateGroup, CreateGroupChat, StartCreateGroupChat } from "./create-group.tsx";
import { prepareNormalNostrEvent } from "../lib/nostr-ts/event.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { InMemoryAccountContext, NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { OtherConfig } from "./config-other.ts";
import { EditGroup, EditGroupChatProfile, StartEditGroupChatProfile } from "./edit-group.tsx";

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
    | StartEditGroupChatProfile;

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
            model.search.searchResults = [];
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
        } else if (event.type == "Search") {
            const pubkey = PublicKey.FromString(event.text);
            if (pubkey instanceof PublicKey) {
                app.profileSyncer.add(pubkey.hex);
                const profile = getProfileEvent(app.database, pubkey);
                model.search.searchResults = [{
                    pubkey: pubkey,
                    profile: profile?.profile,
                }];
            } else {
                const profiles = getProfilesByName(app.database, event.text);
                model.search.searchResults = profiles.map((p) => {
                    const pubkey = PublicKey.FromString(p.pubkey);
                    if (pubkey instanceof Error) {
                        throw new Error("impossible");
                    }
                    return {
                        pubkey: pubkey,
                        profile: p.profile,
                    };
                });
            }
        } //
        //
        // Contacts
        //
        else if (event.type == "SelectConversation") {
            model.search.isSearching = false;
            model.search.searchResults = [];
            model.rightPanelModel = {
                show: false,
            };
            updateConversation(app.model, event.pubkey);

            if (!model.dm.focusedContent.get(event.pubkey.hex)) {
                model.dm.focusedContent.set(event.pubkey.hex, event.pubkey);
            }
            app.popOverInputChan.put({ children: undefined });
        } else if (event.type == "BackToContactList") {
            model.dm.currentSelectedContact = undefined;
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
            );
            if (err instanceof Error) {
                console.error("update:SendMessage", err);
                continue; // todo: global error toast
            }
        } else if (event.type == "UpdateMessageFiles") {
            if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
                const editor = model.editors.get(event.id);
                if (editor) {
                    editor.files = event.files;
                } else {
                    console.log(event.target.receiver, event.id);
                    throw new Error("impossible state");
                }
            }
        } else if (event.type == "UpdateMessageText") {
            if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
                const editor = model.editors.get(event.id);
                if (editor) {
                    editor.text = event.text;
                } else {
                    console.log(event.target.receiver, event.id);
                    throw new Error("impossible state");
                }
            }
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
                if (model.dm.currentSelectedContact) {
                    model.dm.focusedContent.set(
                        model.dm.currentSelectedContact.hex,
                        event.root,
                    );
                }
            }
            model.rightPanelModel.show = true;
        } else if (event.type == "ViewUserDetail") {
            if (
                model.navigationModel.activeNav == "DM"
            ) {
                if (model.dm.currentSelectedContact) {
                    model.dm.focusedContent.set(
                        model.dm.currentSelectedContact.hex,
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
                updateConversation(model, PublicKey.FromHex(root.pubkey) as PublicKey);
                if (model.dm.currentSelectedContact) {
                    model.dm.focusedContent.set(
                        model.dm.currentSelectedContact.hex,
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

            const groupCtx = app.groupChatController.createGroupChat();
            const creationEvent = await app.groupChatController.encodeCreationsToNostrEvent(groupCtx);
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
                groupCtx,
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
            app.profileSyncer.add(groupCtx.publicKey.hex);
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
        } else if (event.type == "RelayConfigChange") {
            const e = await app.relayConfig.toNostrEvent(app.ctx);
            if (e instanceof Error) {
                throw e; // impossible
            }
            pool.sendEvent(e);
            app.relayConfig.saveToLocalStorage(app.ctx);
        } else if (event.type == "ViewEventDetail") {
            const nostrEvent = event.event;
            const eventID = nostrEvent.id;
            const eventIDBech32 = NoteID.FromString(nostrEvent.id).bech32();
            const authorPubkey = nostrEvent.publicKey.hex;
            const authorPubkeyBech32 = nostrEvent.publicKey.bech32();
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
                        authorPubkey,
                        authorPubkeyBech32,
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

export function getConversationMessages(args: {
    targetPubkey: string;
    allUserInfo: Map<string, ConversationSummary>;
    dmGetter: DirectMessageGetter;
}): MessageThread[] {
    const { targetPubkey, allUserInfo } = args;
    let t = Date.now();

    let events = args.dmGetter.getDirectMessages(targetPubkey);
    if (events == undefined) {
        events = [];
    }

    const threads = computeThreads(Array.from(events));
    console.log("getConversationMessages:compute threads", Date.now() - t);
    const msgs: MessageThread[] = [];
    for (const thread of threads) {
        const messages = convertEventsToChatMessages(thread, allUserInfo);
        if (messages.length > 0) {
            messages.sort((m1, m2) => {
                if (m1.lamport && m2.lamport && m1.lamport != m2.lamport) {
                    return m1.lamport - m2.lamport;
                }
                return m1.created_at.getTime() - m2.created_at.getTime();
            });
            msgs.push({
                root: messages[0],
                replies: messages.slice(1),
                // replies: [],
            });
        }
    }
    console.log("getConversationMessages:convert", Date.now() - t);
    return msgs;
}

export function updateConversation(
    model: Model,
    targetPublicKey: PublicKey,
) {
    model.dm.hasNewMessages.delete(targetPublicKey.hex);
    // If this conversation is new
    if (!model.editors.has(targetPublicKey.hex)) {
        model.editors.set(targetPublicKey.hex, {
            id: targetPublicKey.hex,
            files: [],
            text: "",
            tags: [],
            target: {
                kind: NostrKind.DIRECT_MESSAGE,
                receiver: {
                    pubkey: targetPublicKey,
                },
            },
        });
    }
    model.dm.currentSelectedContact = targetPublicKey;
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
                            new_DM_EditorModel({
                                pubkey,
                            }),
                        );
                    }
                }

                if (model.dm.currentSelectedContact) {
                    updateConversation(
                        model,
                        model.dm.currentSelectedContact,
                    );
                }

                if (e.kind == NostrKind.META_DATA) {
                    if (model.search.searchResults.length > 0) {
                        const previous = model.search.searchResults;
                        model.search.searchResults = previous.map((profile) => {
                            const profileEvent = getProfileEvent(database, profile.pubkey);
                            return {
                                pubkey: profile.pubkey,
                                profile: profileEvent?.profile,
                            };
                        });
                    }
                    // my profile update
                    if (ctx && e.pubkey == ctx.publicKey.hex) {
                        const newProfile = getProfileEvent(database, ctx.publicKey);
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
                    if (e.pubkey != ctx.publicKey.hex) {
                        if (model.dm.currentSelectedContact?.hex != e.pubkey) {
                            model.dm.hasNewMessages.add(e.pubkey);
                        }
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
    dmEditors: Map<string, DM_EditorModel>,
    db: Database_Contextual_View,
) {
    if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
        const events = await sendDMandImages({
            sender: ctx,
            receiverPublicKey: event.target.receiver.pubkey,
            message: event.text,
            files: event.files,
            kind: event.target.kind,
            lamport_timestamp: lamport.now(),
            pool,
            tags: event.tags,
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
        const editor = dmEditors.get(event.id);
        if (editor) {
            editor.files = [];
            editor.text = "";
        }
    }
}
