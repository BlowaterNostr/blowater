import { getProfileEvent, getProfilesByName, saveProfile } from "../features/profile.ts";

import { App } from "./app.tsx";
import { AllUsersInformation, getGroupOf, ProfilesSyncer, UserInfo } from "./contact-list.ts";

import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { Database_Contextual_View } from "../database.ts";
import { convertEventsToChatMessages } from "./dm.ts";

import { get_Kind4_Events_Between, sendDMandImages, sendSocialPost } from "../features/dm.ts";
import { notify } from "./notification.ts";
import { EventBus, EventEmitter } from "../event-bus.ts";
import { ContactUpdate } from "./contact-list.tsx";
import { MyProfileUpdate } from "./edit-profile.tsx";
import { EditorEvent, new_DM_EditorModel } from "./editor.tsx";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { NavigationUpdate } from "./nav.tsx";
import { Model } from "./app_model.ts";
import { SearchUpdate, SelectProfile } from "./search_model.ts";
import { fromEvents, LamportTime } from "../time.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    prepareCustomAppDataEvent,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { ConnectionPool } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { SignInEvent, signInWithExtension, signInWithPrivateKey } from "./signIn.tsx";
import {
    computeThreads,
    Decrypted_Nostr_Event,
    getTags,
    PinContact,
    PlainText_Nostr_Event,
    Profile_Nostr_Event,
    UnpinContact,
} from "../nostr.ts";
import { MessageThread } from "./dm.tsx";
import { DexieDatabase } from "./dexie-db.ts";
import { getSocialPosts } from "../features/social.ts";

export type UI_Interaction_Event =
    | RemoveRelayButtonClicked
    | AddRelayButtonClicked
    | AddRelayInputChange
    | SearchUpdate
    | ContactUpdate
    | EditorEvent
    | NavigationUpdate
    | DirectMessagePanelUpdate
    | BackToContactList
    | MyProfileUpdate
    | PinContact
    | UnpinContact
    | SignInEvent;

type RemoveRelayButtonClicked = {
    type: "RemoveRelayButtonClicked";
    url: string;
};
type AddRelayButtonClicked = {
    type: "AddRelayButtonClicked";
    url: string;
};
type AddRelayInputChange = {
    type: "AddRelayInputChange";
    url: string;
};
type BackToContactList = {
    type: "BackToContactList";
};
export type AppEventBus = EventBus<UI_Interaction_Event>;

/////////////////////
// UI Interfaction //
/////////////////////
export async function* UI_Interaction_Update(
    model: Model,
    eventBus: AppEventBus,
    dexieDB: DexieDatabase,
    pool: ConnectionPool,
) {
    const events = eventBus.onChange();
    for await (const event of events) {
        console.log(event);
        switch (event.type) {
            case "editSignInPrivateKey":
                model.signIn.privateKey = event.privateKey;
                yield model;
                continue;
                break;
            case "createNewAccount":
                model.signIn.state = "newAccount";
                yield model;
                continue;
                break;
            case "backToSignInPage":
                model.signIn.state = "enterPrivateKey";
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
                    const app = new App(dbView, lamport, model, ctx, eventBus, pool);
                    const err = await app.initApp(ctx);
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

        if (model.app == undefined) { // if not signed in
            console.warn(event, "is not valid before signing");
            console.warn("This could not happen!");
            continue;
        }
        // All events below are only valid after signning in
        //

        // Relay
        //
        if (event.type == "AddRelayButtonClicked") {
            // todo: need to think about concurrent/async UI update
            model.app.relayPool.addRelayURL(event.url).then((err) => {
                if (err instanceof Error) {
                    model.AddRelayButtonClickedError = err.message;
                } else {
                    model.AddRelayButtonClickedError = "";
                }
            });
            model.AddRelayInput = "";
        } else if (event.type == "AddRelayInputChange") {
            model.AddRelayInput = event.url;
        } else if (event.type == "RemoveRelayButtonClicked") {
            await model.app.relayPool.removeRelay(event.url);
        } //
        //
        // Search
        //
        else if (event.type == "CancelSearch") {
            model.dm.search.isSearching = false;
            model.dm.search.searchResults = [];
        } else if (event.type == "StartSearch") {
            model.dm.search.isSearching = true;
        } else if (event.type == "Search") {
            const pubkey = PublicKey.FromString(event.text);
            if (pubkey instanceof PublicKey) {
                await model.app.profileSyncer.add(pubkey.hex);
                const profile = getProfileEvent(model.app.database, pubkey);
                model.dm.search.searchResults = [{
                    pubkey: pubkey,
                    profile: profile?.profile,
                }];
            } else {
                const profiles = getProfilesByName(model.app.database, event.text);
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
                model.app.allUsersInfo.userInfos,
            );
            model.dm.selectedContactGroup = group;
            updateConversation(model.app.model, event.pubkey);

            if (!model.dm.focusedContent.get(event.pubkey.hex)) {
                model.dm.focusedContent.set(event.pubkey.hex, event.pubkey);
            }
        } else if (event.type == "BackToContactList") {
            model.dm.currentSelectedContact = undefined;
        } else if (event.type == "SelectGroup") {
            model.dm.selectedContactGroup = event.group;
        } else if (event.type == "PinContact" || event.type == "UnpinContact") {
            if (!model.app.myAccountContext) {
                throw new Error(`can't handle ${event.type} if not signed`);
            }
            const nostrEvent = await prepareCustomAppDataEvent(model.app.myAccountContext, event);
            if (nostrEvent instanceof Error) {
                console.error(nostrEvent);
                continue;
            }
            const err = await model.app.relayPool.sendEvent(nostrEvent);
            if (err instanceof Error) {
                console.error(err);
            }
            console.log("send", nostrEvent);
        } //
        //
        // Editor
        //
        else if (event.type == "SendMessage") {
            if (!model.app.myAccountContext) {
                throw new Error(`can't handle ${event.type} if not signed`);
            }
            if (event.target.kind == NostrKind.DIRECT_MESSAGE) {
                const err = await sendDMandImages({
                    sender: model.app.myAccountContext,
                    receiverPublicKey: event.target.receiver.pubkey,
                    message: event.text,
                    files: event.files,
                    kind: event.target.kind,
                    lamport_timestamp: model.app.lamport.now(),
                    pool: model.app.relayPool,
                    waitAll: false,
                    tags: event.tags,
                });
                if (err instanceof Error) {
                    console.error("update:SendMessage", err);
                    continue; // todo: global error toast
                }
                const editor = model.editors.get(event.id);
                if (editor) {
                    editor.files = [];
                    editor.text = "";
                }
            } else {
                sendSocialPost({
                    sender: model.app.myAccountContext,
                    message: event.text,
                    lamport_timestamp: model.app.lamport.now(),
                    pool: model.app.relayPool,
                    tags: event.tags,
                });
                if (event.id == "social") {
                    model.social.editor.files = [];
                    model.social.editor.text = "";
                }
                const editor = model.social.replyEditors.get(event.id);
                if (editor) {
                    editor.files = [];
                    editor.text = "";
                }
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
            if (!model.app.myAccountContext) {
                throw new Error(`can't handle ${event.type} if not signed`);
            }
            InsertNewProfileField(model.app.model);
            await saveProfile(
                event.profile,
                model.app.myAccountContext,
                model.app.relayPool,
            );
        } else if (event.type == "EditNewProfileFieldKey") {
            model.newProfileField.key = event.key;
        } else if (event.type == "EditNewProfileFieldValue") {
            model.newProfileField.value = event.value;
        } else if (event.type == "InsertNewProfileField") {
            InsertNewProfileField(model.app.model);
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
        }
        yield model;
    }
}

export function getConversationMessages(args: {
    database: Database_Contextual_View;
    pub1: string;
    pub2: string;
    allUserInfo: Map<string, UserInfo>;
}): MessageThread[] {
    const { database, pub1, pub2, allUserInfo } = args;
    let t = Date.now();
    const events = get_Kind4_Events_Between(database, pub1, pub2);
    // console.log("getConversationMessages:filter events", Date.now() - t)
    const threads = computeThreads(Array.from(events));
    // console.log("getConversationMessages:compute threads", Date.now() - t)
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
) {
    const changes = database.onChange((_) => true);
    while (true) {
        await csp.sleep(333);
        await changes.ready();
        const changes_events: (PlainText_Nostr_Event | Decrypted_Nostr_Event | Profile_Nostr_Event)[] = [];
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
        for (let e of changes_events) {
            allUserInfo.addEvents([e]);
            const t = getTags(e).lamport_timestamp;
            if (t) {
                lamport.set(t);
            }
            const key = PublicKey.FromHex(e.pubkey);
            if (key instanceof PublicKey) {
                await profileSyncer.add(key.hex);
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
                    const author = getProfileEvent(database, pubkey);
                    if (e.pubkey != ctx.publicKey.hex) {
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
                        model.dm.currentSelectedContact;
                        if (model.dm.currentSelectedContact?.hex != e.pubkey) {
                            model.dm.hasNewMessages.add(e.pubkey);
                        }
                    }
                }
            } else if (e.kind == NostrKind.TEXT_NOTE) {
                hasKind_1 = true;
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
export async function* Relay_Update(relayPool: ConnectionPool) {
    for await (const _ of relayPool.onChange()) {
        for (const relay of relayPool.getRelays()) {
            if (relay.isClosed() && !relay.isClosedByClient) {
                await relayPool.removeRelay(relay.url);
                while (true) {
                    const err = await relayPool.addRelayURL(relay.url);
                    if (err) {
                        console.error(err);
                        continue;
                    }
                    break;
                }
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
