/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { getProfileEvent, getProfilesByName, ProfilesSyncer, saveProfile } from "../features/profile.ts";

import { App } from "./app.tsx";
import { AllUsersInformation, getGroupOf, getUserInfoFromPublicKey, UserInfo } from "./contact-list.ts";

import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database_Contextual_View } from "../database.ts";
import { convertEventsToChatMessages } from "./dm.ts";

import { sendDMandImages, sendSocialPost } from "../features/dm.ts";
import { notify } from "./notification.ts";
import { EventBus, EventEmitter } from "../event-bus.ts";
import { ContactUpdate } from "./contact-list.tsx";
import { MyProfileUpdate } from "./edit-profile.tsx";
import {
    DM_EditorModel,
    EditorEvent,
    new_DM_EditorModel,
    SendMessage,
    Social_EditorModel,
} from "./editor.tsx";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { NavigationUpdate } from "./nav.tsx";
import { Model } from "./app_model.ts";
import { SearchUpdate, SelectProfile } from "./search_model.ts";
import { fromEvents, LamportTime } from "../time.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool, RelayAlreadyRegistered } from "../lib/nostr-ts/relay.ts";
import { SignInEvent, signInWithExtension, signInWithPrivateKey } from "./signIn.tsx";
import {
    computeThreads,
    CustomAppData_Event,
    getTags,
    PinContact,
    PlainText_Nostr_Event,
    Profile_Nostr_Event,
    UnpinContact,
} from "../nostr.ts";
import { MessageThread } from "./dm.tsx";
import { DexieDatabase } from "./dexie-db.ts";
import { getSocialPosts } from "../features/social.ts";
import { RelayConfig } from "./setting.ts";
import { SocialUpdates } from "./social.tsx";
import { RelayConfigChange } from "./setting.tsx";
import { prepareCustomAppDataEvent } from "../lib/nostr-ts/event.ts";
import { PopOverInputChannel } from "./components/popover.tsx";
import { Search } from "./search.tsx";
import { NoteID } from "../lib/nostr-ts/nip19.ts";
import { EventDetail, EventDetailItem } from "./event-detail.tsx";

export type UI_Interaction_Event =
    | SearchUpdate
    | ContactUpdate
    | EditorEvent
    | NavigationUpdate
    | DirectMessagePanelUpdate
    | BackToContactList
    | MyProfileUpdate
    | PinContact
    | UnpinContact
    | SignInEvent
    | SocialUpdates
    | RelayConfigChange;

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
                    const lamport = fromEvents(dbView.filterEvents((_) => true));
                    const app = new App(dbView, lamport, model, ctx, eventBus, pool, args.popOver);
                    const err = await app.initApp(ctx, pool);
                    if (err instanceof Error) {
                        console.error(err.message);
                    }
                    model.app = app;
                } else {
                    console.error("failed to sign in");
                }
                yield model;
                continue;
                break;
        }

        const app = model.app;
        if (app == undefined) { // if not signed in
            console.warn(event, "is not valid before signing");
            console.warn("This could not happen!");
            continue;
        } // All events below are only valid after signning in
        //

        //
        // Search
        //
        else if (event.type == "CancelPopOver") {
            model.dm.search.isSearching = false;
            model.dm.search.searchResults = [];
        } else if (event.type == "StartSearch") {
            model.dm.search.isSearching = true;
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
                model.dm.search.searchResults = [{
                    pubkey: pubkey,
                    profile: profile?.profile,
                }];
            } else {
                const profiles = getProfilesByName(app.database, event.text);
                model.dm.search.searchResults = profiles.map((p) => {
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
        else if (event.type == "SelectProfile") {
            model.dm.search.isSearching = false;
            model.dm.search.searchResults = [];
            model.rightPanelModel = {
                show: false,
            };
            const group = getGroupOf(
                event.pubkey,
                app.allUsersInfo.userInfos,
            );
            model.dm.selectedContactGroup = group;
            updateConversation(app.model, event.pubkey);

            if (!model.dm.focusedContent.get(event.pubkey.hex)) {
                model.dm.focusedContent.set(event.pubkey.hex, event.pubkey);
            }
            app.popOverInputChan.put({ children: undefined });
        } else if (event.type == "BackToContactList") {
            model.dm.currentSelectedContact = undefined;
        } else if (event.type == "SelectGroup") {
            model.dm.selectedContactGroup = event.group;
        } else if (event.type == "PinContact" || event.type == "UnpinContact") {
            if (!app.myAccountContext) {
                throw new Error(`can't handle ${event.type} if not signed`);
            }
            const nostrEvent = await prepareCustomAppDataEvent(app.myAccountContext, event);
            if (nostrEvent instanceof Error) {
                console.error(nostrEvent);
                continue;
            }
            const err = await pool.sendEvent(nostrEvent);
            if (err instanceof Error) {
                console.error(err);
            }
            console.log("send", nostrEvent);
        } //
        //
        // Editor
        //
        else if (event.type == "SendMessage") {
            if (!app.myAccountContext) {
                throw new Error(`can't handle ${event.type} if not signed`);
            }
            const err = await handle_SendMessage(
                event,
                app.myAccountContext,
                app.lamport,
                pool,
                app.model.editors,
                app.model.social.editor,
                app.model.social.replyEditors,
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
            } else {
                if (event.id == "social") {
                    model.social.editor.files = event.files;
                } else {
                    const editor = model.social.replyEditors.get(event.id);
                    if (editor) {
                        editor.files = event.files;
                    } else {
                        throw new Error("impossible state");
                    }
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
            } else {
                if (event.id == "social") {
                    model.social.editor.text = event.text;
                } else {
                    const editor = model.social.replyEditors.get(event.id);
                    if (editor) {
                        editor.text = event.text;
                    } else {
                        throw new Error("impossible state");
                    }
                }
            }
        } //
        //
        // MyProfile
        //
        else if (event.type == "EditMyProfile") {
            model.myProfile = Object.assign(model.myProfile || {}, event.profile);
        } else if (event.type == "SaveMyProfile") {
            if (!app.myAccountContext) {
                throw new Error(`can't handle ${event.type} if not signed`);
            }
            InsertNewProfileField(app.model);
            await saveProfile(
                event.profile,
                app.myAccountContext,
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
            if (model.navigationModel.activeNav == "Social") {
                model.social.focusedContent = event.root;
            } else if (model.navigationModel.activeNav == "DM") {
                if (model.dm.currentSelectedContact) {
                    model.dm.focusedContent.set(
                        model.dm.currentSelectedContact.hex,
                        event.root,
                    );
                }
            }
            model.rightPanelModel.show = true;
        } else if (event.type == "ViewUserDetail") {
            if (model.navigationModel.activeNav == "Social") {
                model.social.focusedContent = event.pubkey;
            } else if (
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
        } //
        //
        // Social
        //
        else if (event.type == "SocialFilterChanged_content") {
            model.social.filter.content = event.content;
        } else if (event.type == "SocialFilterChanged_authors") {
            if (model.social.filter.adding_author) {
                model.social.filter.author.add(model.social.filter.adding_author);
                model.social.filter.adding_author = "";

                const pubkeys: string[] = [];
                for (const userInfo of app.allUsersInfo.userInfos.values()) {
                    for (const name of model.social.filter.author) {
                        if (userInfo.profile?.profile.name?.toLowerCase().includes(name.toLowerCase())) {
                            pubkeys.push(userInfo.pubkey.hex);
                            continue;
                        }
                    }
                }

                /* do not await */ app.eventSyncer.syncEvents({
                    kinds: [NostrKind.TEXT_NOTE],
                    authors: pubkeys,
                });
                // model.social.activeSyncingFilter =
            }
        } else if (event.type == "SocialFilterChanged_adding_author") {
            model.social.filter.adding_author = event.value;
        } else if (event.type == "SocialFilterChanged_remove_author") {
            model.social.filter.author.delete(event.value);
        } else if (event.type == "RelayConfigChange") {
            const e = await app.relayConfig.toNostrEvent(app.myAccountContext, true);
            if (e instanceof Error) {
                throw e; // impossible
            }
            pool.sendEvent(e);
            app.relayConfig.saveToLocalStorage(app.myAccountContext);
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

export function getConversationMessages(args: {
    targetPubkey: string;
    allUserInfo: Map<string, UserInfo>;
}): MessageThread[] {
    const { targetPubkey, allUserInfo } = args;
    let t = Date.now();

    let events = allUserInfo.get(targetPubkey)?.events;
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
    profileSyncer: ProfilesSyncer,
    lamport: LamportTime,
    eventEmitter: EventEmitter<SelectProfile>,
    allUserInfo: AllUsersInformation,
    relayConfig: RelayConfig,
) {
    const changes = database.subscribe((_) => true);
    while (true) {
        await csp.sleep(333);
        await changes.ready();
        const changes_events: (PlainText_Nostr_Event | CustomAppData_Event | Profile_Nostr_Event)[] = [];
        while (true) {
            if (!changes.isReadyToPop()) {
                break;
            }
            const e = await changes.pop();
            if (e == csp.closed) {
                console.error("unreachable: db changes channel should never close");
                break;
            }
            changes_events.push(e);
        }

        let hasKind_1 = false;
        {
            const events = [];
            for (const e of changes_events) {
                if (e.kind == NostrKind.CustomAppData) {
                    events.push(e);
                }
            }
            // await relayConfig.addEvents(events);
        }
        for (let e of changes_events) {
            allUserInfo.addEvents([e]);
            const t = getTags(e).lamport_timestamp;
            if (t) {
                lamport.set(t);
            }
            const key = PublicKey.FromHex(e.pubkey);
            if (key instanceof PublicKey) {
                profileSyncer.add(key.hex);
            }
            if (e.kind == NostrKind.META_DATA || e.kind == NostrKind.DIRECT_MESSAGE) {
                for (const contact of allUserInfo.userInfos.values()) {
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
                    if (model.dm.search.searchResults.length > 0) {
                        const previous = model.dm.search.searchResults;
                        model.dm.search.searchResults = previous.map((profile) => {
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
                const author = getUserInfoFromPublicKey(e.publicKey, allUserInfo.userInfos)?.profile;
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
                            eventEmitter.emit({
                                type: "SelectProfile",
                                pubkey: k,
                            });
                        },
                    );
                }
            }
        }
        if (hasKind_1) {
            model.social.threads = getSocialPosts(database, allUserInfo.userInfos);
        }
        yield model;
    }
}

///////////
// Relay //
///////////
export async function* Relay_Update(
    relayPool: ConnectionPool,
    relayConfig: RelayConfig,
    ctx: NostrAccountContext,
) {
    for (;;) {
        await csp.sleep(1000 * 2.5); // every 2.5 sec
        console.log(`Relay: checking connections`);
        let changed = false;
        // first, remove closed relays
        const relays = relayPool.getRelays();
        for (const relay of relays) {
            if (relay.isClosed()) {
                await relayPool.removeRelay(relay.url);
                changed = true;
            }
        }
        // second, add urls
        for (const url of relayConfig.getRelayURLs()) {
            const err = await relayPool.addRelayURL(url);
            if (err instanceof Error && !(err instanceof RelayAlreadyRegistered)) {
                console.log(err.message);
            }
        }
        if (changed) {
            const event = await relayConfig.toNostrEvent(ctx, true);
            if (!(event instanceof Error)) {
                relayPool.sendEvent(event);
            }
        }
        yield;
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
    socialEditor: Social_EditorModel,
    replyEditors: Map<string, Social_EditorModel>,
) {
    if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
        const err = await sendDMandImages({
            sender: ctx,
            receiverPublicKey: event.target.receiver.pubkey,
            message: event.text,
            files: event.files,
            kind: event.target.kind,
            lamport_timestamp: lamport.now(),
            pool,
            waitAll: false,
            tags: event.tags,
        });
        if (err instanceof Error) {
            return err;
        }
        const editor = dmEditors.get(event.id);
        if (editor) {
            editor.files = [];
            editor.text = "";
        }
    } else {
        sendSocialPost({
            sender: ctx,
            message: event.text,
            lamport_timestamp: lamport.now(),
            pool,
            tags: event.tags,
        });
        if (event.id == "social") {
            socialEditor.files = [];
            socialEditor.text = "";
        }
        const editor = replyEditors.get(event.id);
        if (editor) {
            editor.files = [];
            editor.text = "";
        }
    }
}
