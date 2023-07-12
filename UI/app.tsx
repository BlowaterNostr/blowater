/** @jsx h */
import { h, render, VNode } from "https://esm.sh/preact@10.11.3";
import * as dm from "../features/dm.ts";

import { DirectMessageContainer, MessageThread } from "./dm.tsx";
import * as db from "../database.ts";

import { tw } from "https://esm.sh/twind@0.16.16";
import { EditProfile } from "./edit-profile.tsx";
import * as nav from "./nav.tsx";
import { EventBus } from "../event-bus.ts";
import { MessagePanel } from "./message-panel.tsx";

import { Setting } from "./setting.tsx";
import { Database_Contextual_View } from "../database.ts";

import { getAllUsersInformation, ProfilesSyncer, UserInfo } from "./contact-list.ts";

import { new_DM_EditorModel } from "./editor.tsx";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { initialModel, Model } from "./app_model.ts";
import {
    AppEventBus,
    Database_Update,
    Relay_Update,
    UI_Interaction_Event,
    UI_Interaction_Update,
} from "./app_update.ts";
import { getSocialPosts } from "../features/social.ts";
import * as time from "../time.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    DecryptionFailure,
    decryptNostrEvent,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import {
    ConnectionPool,
    newSubID,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/relay.ts";
import { getCurrentSignInCtx, setSignInState, SignIn } from "./signIn.tsx";
import { AppList } from "./app-list.tsx";
import { LinkColor, PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";
import { EventSyncer } from "./event_syncer.ts";
import { getRelayURLs } from "./setting.ts";
import { DexieDatabase } from "./dexie-db.ts";
import { DividerClass } from "./components/tw.ts";
import { About } from "./about.tsx";

export async function Start(database: DexieDatabase) {
    const model = initialModel();
    const eventBus = new EventBus<UI_Interaction_Event>();
    const pool = new ConnectionPool();

    console.log("Start the application");

    const ctx = await getCurrentSignInCtx();
    console.log("Start:", ctx);
    if (ctx instanceof Error) {
        console.error(ctx);
        model.signIn.warningString = "Please add your private key to your NIP-7 extension";
    } else if (ctx) {
        const dbView = await Database_Contextual_View.New(database, ctx);
        const lamport = time.fromEvents(dbView.filterEvents((_) => true));
        const app = new App(dbView, lamport, model, ctx, eventBus, pool);
        const err = await app.initApp(ctx);
        if (err instanceof Error) {
            throw err;
        }
        model.app = app;
    }

    /* first render */ render(<AppComponent model={model} eventBus={eventBus} />, document.body);

    for await (let _ of UI_Interaction_Update(model, eventBus, database, pool)) {
        const t = Date.now();
        {
            render(<AppComponent model={model} eventBus={eventBus} />, document.body);
        }
        console.log("render", Date.now() - t);
    }

    (async () => {
        for await (let _ of Relay_Update(pool)) {
            render(<AppComponent model={model} eventBus={eventBus} />, document.body);
        }
    })();
}

async function initProfileSyncer(
    pool: ConnectionPool,
    accountContext: NostrAccountContext,
    database: db.Database_Contextual_View,
) {
    const myPublicKey = accountContext.publicKey;

    ////////////////////
    // Init Core Data //
    ////////////////////
    const newestEvent = dm.getNewestEventOf(database, myPublicKey);
    console.info("newestEvent", newestEvent);
    const _24h = 60 * 60 * 24;
    let since: number = _24h;
    if (newestEvent !== db.NotFound) {
        since = newestEvent.created_at - _24h;
    }
    console.info("since", new Date(since * 1000));

    // Sync DM events
    const messageStream = dm.getAllEncryptedMessagesOf(
        myPublicKey,
        pool,
        since,
    );
    database.syncNewDirectMessageEventsOf(
        accountContext,
        messageStream,
    );

    // Sync my profile events
    const profilesSyncer = new ProfilesSyncer(database, pool);
    await profilesSyncer.add(myPublicKey.hex);

    // Sync Custom App Data
    (async () => {
        let subId = newSubID();
        let resp = await pool.newSub(
            subId,
            {
                authors: [myPublicKey.hex],
                kinds: [NostrKind.CustomAppData],
            },
        );
        if (resp instanceof Error) {
            throw resp;
        }
        for await (const { res, url } of resp) {
            if (res.type == "EVENT") {
                database.addEvent(res.event);
            }
        }
    })();

    ///////////////////////////////////
    // Add relays to Connection Pool //
    ///////////////////////////////////
    const relayURLs = getRelayURLs(database);
    pool.addRelayURLs(relayURLs);

    return profilesSyncer;
}

export class App {
    profileSyncer!: ProfilesSyncer;
    eventSyncer: EventSyncer;

    constructor(
        public readonly database: Database_Contextual_View,
        public readonly lamport: time.LamportTime,
        public readonly model: Model,
        public readonly myAccountContext: NostrAccountContext,
        public readonly eventBus: EventBus<UI_Interaction_Event>,
        public readonly relayPool: ConnectionPool,
    ) {
        this.eventSyncer = new EventSyncer(this.relayPool, this.database);
    }

    initApp = async (accountContext: NostrAccountContext) => {
        console.log("App.initApp");
        const profilesSyncer = await initProfileSyncer(this.relayPool, accountContext, this.database);
        if (profilesSyncer instanceof Error) {
            return profilesSyncer;
        }

        this.profileSyncer = profilesSyncer;

        const allUsersInfo = getAllUsersInformation(this.database, this.myAccountContext);
        console.log("App allUsersInfo");

        /* my profile */
        this.model.myProfile = allUsersInfo.get(accountContext.publicKey.hex)?.profile?.content;

        /* contacts */
        for (const contact of allUsersInfo.values()) {
            const editor = this.model.editors.get(contact.pubkey.hex);
            if (editor == null) {
                const pubkey = PublicKey.FromHex(contact.pubkey.hex);
                if (pubkey instanceof Error) {
                    throw pubkey; // impossible
                }
                this.model.editors.set(
                    contact.pubkey.hex,
                    new_DM_EditorModel({
                        pubkey,
                        name: contact.profile?.content.name,
                        picture: contact.profile?.content.picture,
                    }),
                );
            }
        }

        await profilesSyncer.add(
            ...Array.from(allUsersInfo.keys()),
        );
        console.log("user set", profilesSyncer.userSet);

        // Database
        (async () => {
            let i = 0;
            for await (
                let _ of Database_Update(
                    accountContext,
                    this.database,
                    this.model,
                    this.profileSyncer,
                    this.lamport,
                    this.eventBus,
                )
            ) {
                render(<AppComponent model={this.model} eventBus={this.eventBus} />, document.body);
                console.log(`render ${++i} times`);
            }
        })();
    };

    logout = () => {
        setSignInState("none");
        window.location.reload();
    };
}

export function AppComponent(props: {
    model: Model;
    eventBus: AppEventBus;
}) {
    const t = Date.now();
    const model = props.model;

    if (model.app == undefined) {
        console.log("render sign in page");
        return (
            <SignIn
                eventBus={props.eventBus}
                privateKey={model.signIn.privateKey}
                state={model.signIn.state}
                warningString={model.signIn.warningString}
            />
        );
    }

    const app = model.app;
    const myAccountCtx = model.app.myAccountContext;

    let socialPostsPanel: VNode | undefined;
    if (model.navigationModel.activeNav == "Social") {
        const allUserInfo = getAllUsersInformation(app.database, myAccountCtx);
        // console.log("AppComponent:getSocialPosts before", Date.now() - t);
        const socialPosts = getSocialPosts(app.database, allUserInfo);
        // console.log("AppComponent:getSocialPosts after", Date.now() - t, Date.now());
        let focusedContentGetter = () => {
            // console.log("AppComponent:getFocusedContent before", Date.now() - t);
            let _ = getFocusedContent(model.social.focusedContent, allUserInfo, socialPosts);
            // console.log("AppComponent:getFocusedContent", Date.now() - t);
            if (_?.type === "MessageThread") {
                let editor = model.social.replyEditors.get(_.data.root.event.id);
                if (editor == undefined) {
                    editor = {
                        id: _.data.root.event.id,
                        files: [],
                        text: "",
                        tags: [
                            ["e", _.data.root.event.id],
                        ],
                        target: {
                            kind: NostrKind.TEXT_NOTE,
                        },
                    };
                    model.social.replyEditors.set(editor.id, editor);
                }
                return {
                    ..._,
                    editor,
                };
            }
            return _;
        };
        console.log("AppComponent:focusedContentGetter", Date.now() - t);
        let focusedContent = focusedContentGetter();
        console.log("AppComponent:socialPosts", Date.now() - t);
        socialPostsPanel = (
            <div
                class={tw`flex-1 overflow-hidden bg-[#313338]`}
            >
                <MessagePanel
                    focusedContent={focusedContent}
                    editorModel={model.social.editor}
                    myPublicKey={myAccountCtx.publicKey}
                    messages={socialPosts}
                    rightPanelModel={model.rightPanelModel}
                    db={app.database}
                    eventEmitter={app.eventBus}
                    profilesSyncer={app.profileSyncer}
                    eventSyncer={app.eventSyncer}
                />
            </div>
        );
    }

    let settingNode;
    if (model.navigationModel.activeNav == "Setting") {
        settingNode = (
            <div
                class={tw`flex-1 overflow-hidden overflow-y-auto bg-[${SecondaryBackgroundColor}]`}
            >
                {Setting({
                    logout: app.logout,
                    pool: app.relayPool,
                    eventBus: app.eventBus,
                    AddRelayButtonClickedError: model.AddRelayButtonClickedError,
                    AddRelayInput: model.AddRelayInput,
                    myAccountContext: myAccountCtx,
                })}
            </div>
        );
    }

    let appList;
    if (model.navigationModel.activeNav == "AppList") {
        appList = (
            <div
                class={tw`flex-1 overflow-hidden overflow-y-auto bg-[#313338]`}
            >
                <AppList />
            </div>
        );
    }

    let dmVNode;
    let aboutNode;
    if (
        model.navigationModel.activeNav == "DM" ||
        model.navigationModel.activeNav == "About"
    ) {
        const allUserInfo = getAllUsersInformation(app.database, myAccountCtx);
        if (model.navigationModel.activeNav == "DM") {
            dmVNode = (
                <div
                    class={tw`flex-1 overflow-hidden`}
                >
                    {DirectMessageContainer({
                        editors: model.editors,
                        ...model.dm,
                        rightPanelModel: model.rightPanelModel,
                        eventEmitter: app.eventBus,
                        myAccountContext: myAccountCtx,
                        db: app.database,
                        pool: app.relayPool,
                        allUserInfo: allUserInfo,
                        profilesSyncer: app.profileSyncer,
                        eventSyncer: app.eventSyncer,
                    })}
                </div>
            );
        }

        if (model.navigationModel.activeNav == "About") {
            aboutNode = About();
        }
    }

    const final = (
        <div
            class={tw`font-roboto flex flex-col h-screen w-screen overflow-hidden`}
        >
            <div class={tw`w-full h-full flex flex-col`}>
                <div class={tw`w-full flex-1 flex overflow-hidden`}>
                    <div class={tw`mobile:hidden`}>
                        {nav.NavBar({
                            profilePicURL: model.myProfile?.picture,
                            publicKey: myAccountCtx.publicKey,
                            database: app.database,
                            pool: app.relayPool,
                            eventEmitter: app.eventBus,
                            AddRelayButtonClickedError: model.AddRelayButtonClickedError,
                            AddRelayInput: model.AddRelayInput,
                            ...model.navigationModel,
                        })}
                    </div>

                    <div
                        class={tw`h-full px-[3rem] bg-[${SecondaryBackgroundColor}] flex-1 overflow-auto${
                            model.navigationModel.activeNav == "Profile" ? " block" : " hidden"
                        }`}
                    >
                        <div
                            class={tw`max-w-[35rem] h-full m-auto`}
                        >
                            {EditProfile({
                                eventEmitter: app.eventBus,
                                myProfile: model.myProfile,
                                newProfileField: model.newProfileField,
                            })}
                        </div>
                    </div>
                    {dmVNode}
                    {aboutNode}
                    {settingNode}
                    {socialPostsPanel}
                    {appList}
                </div>

                <div class={tw`desktop:hidden`}>
                    <nav.MobileNavBar
                        profilePicURL={model.myProfile?.picture}
                        publicKey={myAccountCtx.publicKey}
                        database={app.database}
                        pool={app.relayPool}
                        eventEmitter={app.eventBus}
                        AddRelayButtonClickedError={model.AddRelayButtonClickedError}
                        AddRelayInput={model.AddRelayInput}
                        {...model.navigationModel}
                    />
                </div>
            </div>
        </div>
    );

    console.debug("App:end", Date.now() - t);
    return final;
}

// todo: move to somewhere else
export function getFocusedContent(
    focusedContent: PublicKey | NostrEvent | undefined,
    allUserInfo: Map<string, UserInfo>,
    threads: MessageThread[],
) {
    if (focusedContent == undefined) {
        return;
    }
    if (focusedContent instanceof PublicKey) {
        const profileData = allUserInfo.get(focusedContent.hex)?.profile?.content;
        return {
            type: "ProfileData" as "ProfileData",
            data: profileData,
            pubkey: focusedContent,
        };
    } else {
        for (const thread of threads) {
            if (thread.root.event.id == focusedContent.id) {
                return {
                    type: "MessageThread" as "MessageThread",
                    data: thread,
                };
            }
        }
    }
}
