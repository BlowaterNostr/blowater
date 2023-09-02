/** @jsx h */
import { h, render, VNode } from "https://esm.sh/preact@10.11.3";
import * as dm from "../features/dm.ts";

import { DirectMessageContainer, MessageThread } from "./dm.tsx";
import * as db from "../database.ts";

import { tw } from "https://esm.sh/twind@0.16.16";
import { EditProfile } from "./edit-profile.tsx";
import * as nav from "./nav.tsx";
import { EventBus } from "../event-bus.ts";

import { Setting } from "./setting.tsx";
import { Database_Contextual_View } from "../database.ts";

import { AllUsersInformation, UserInfo } from "./contact-list.ts";

import { new_DM_EditorModel } from "./editor.tsx";
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
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { getCurrentSignInCtx, setSignInState, SignIn } from "./signIn.tsx";
import { AppList } from "./app-list.tsx";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { EventSyncer } from "./event_syncer.ts";
import { defaultRelays, RelayConfig } from "./setting.ts";
import { DexieDatabase } from "./dexie-db.ts";
import { About } from "./about.tsx";
import { SocialPanel } from "./social.tsx";
import { ProfilesSyncer } from "../features/profile.ts";
import { Popover } from "./components/popover.tsx";
import { Search } from "./search.tsx";
import { PlainTextEventDetail } from "./plain-text-event-detail.tsx";

export async function Start(database: DexieDatabase) {
    console.log("Start the application");

    const model = initialModel();
    const eventBus = new EventBus<UI_Interaction_Event>();
    const pool = new ConnectionPool();

    const ctx = await getCurrentSignInCtx();
    console.log("Start::with context", ctx);
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

    (async () => {
        for await (let _ of Relay_Update(pool)) {
            render(<AppComponent model={model} eventBus={eventBus} />, document.body);
        }
    })();

    for await (let _ of UI_Interaction_Update({ model, eventBus, dexieDB: database, pool })) {
        const t = Date.now();
        {
            render(<AppComponent model={model} eventBus={eventBus} />, document.body);
        }
        console.log("render", Date.now() - t);
    }
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
    // const newestEvent = dm.getNewestEventOf(database, myPublicKey);
    // console.info("newestEvent", newestEvent);
    // const _24h = 60 * 60 * 24;
    // let since: number = _24h;
    // if (newestEvent !== db.NotFound) {
    // since = newestEvent.created_at - _24h;
    // }
    // console.info("since", new Date(since * 1000));

    // Sync DM events
    const messageStream = dm.getAllEncryptedMessagesOf(
        myPublicKey,
        pool,
    );
    database.syncNewDirectMessageEventsOf(
        accountContext,
        messageStream,
    );

    // Sync my profile events
    const profilesSyncer = new ProfilesSyncer(database, pool);
    profilesSyncer.add(myPublicKey.hex);

    // Sync Custom App Data
    (async () => {
        let resp = await pool.newSub(
            "CustomAppData",
            {
                authors: [myPublicKey.hex],
                kinds: [NostrKind.CustomAppData],
            },
        );
        if (resp instanceof Error) {
            throw resp;
        }
        for await (const { res, url } of resp.chan) {
            if (res.type == "EVENT") {
                database.addEvent(res.event);
            }
        }
    })();

    return profilesSyncer;
}

export class App {
    profileSyncer!: ProfilesSyncer;
    eventSyncer: EventSyncer;
    public readonly allUsersInfo: AllUsersInformation;
    public readonly relayConfig: RelayConfig;

    constructor(
        public readonly database: Database_Contextual_View,
        public readonly lamport: time.LamportTime,
        public readonly model: Model,
        public readonly myAccountContext: NostrAccountContext,
        public readonly eventBus: EventBus<UI_Interaction_Event>,
        relayPool: ConnectionPool,
    ) {
        this.eventSyncer = new EventSyncer(relayPool, this.database);
        this.allUsersInfo = new AllUsersInformation(myAccountContext);
        this.relayConfig = new RelayConfig(relayPool, this.myAccountContext);
    }

    initApp = async (accountContext: NostrAccountContext) => {
        console.log("App.initApp");
        this.allUsersInfo.addEvents(this.database.events);
        {
            ///////////////////////////////////
            // Add relays to Connection Pool //
            ///////////////////////////////////
            const events = [];
            for (const e of this.database.events) {
                if (e.kind == NostrKind.CustomAppData) {
                    events.push(e);
                }
            }
            await this.relayConfig.addEvents(events);
            const urls = this.relayConfig.getRelayURLs();
            if (urls.size == 0) {
                this.relayConfig.pool.addRelayURLs(defaultRelays);
            }
        }

        const profilesSyncer = await initProfileSyncer(this.relayConfig.pool, accountContext, this.database);
        if (profilesSyncer instanceof Error) {
            return profilesSyncer;
        }

        this.profileSyncer = profilesSyncer;

        console.log("App allUsersInfo");
        this.model.social.threads = getSocialPosts(this.database, this.allUsersInfo.userInfos);

        /* my profile */
        this.model.myProfile = this.allUsersInfo.userInfos.get(accountContext.publicKey.hex)?.profile
            ?.profile;

        /* contacts */
        for (const contact of this.allUsersInfo.userInfos.values()) {
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
                        name: contact.profile?.profile.name,
                        picture: contact.profile?.profile.picture,
                    }),
                );
            }
        }

        profilesSyncer.add(
            ...Array.from(this.allUsersInfo.userInfos.keys()),
        );
        console.log("user set", profilesSyncer.userSet);

        const ps = Array.from(this.allUsersInfo.userInfos.values()).map((u) => u.pubkey.hex);
        this.eventSyncer.syncEvents({
            kinds: [NostrKind.TEXT_NOTE],
            authors: ps,
        });

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
                    this.allUsersInfo,
                    this.relayConfig,
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
        let focusedContentGetter = () => {
            // console.log("AppComponent:getFocusedContent before", Date.now() - t);
            let _ = getFocusedContent(
                model.social.focusedContent,
                app.allUsersInfo.userInfos,
                model.social.threads,
            );
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
        let focusedContent = focusedContentGetter();
        console.log("AppComponent:getFocusedContent", Date.now() - t);
        socialPostsPanel = SocialPanel({
            allUsersInfo: app.allUsersInfo,
            ctx: app.myAccountContext,
            db: app.database,
            eventEmitter: app.eventBus,
            eventSyncer: app.eventSyncer,
            focusedContent: focusedContent,
            model: app.model,
            profileSyncer: app.profileSyncer,
        });
        console.debug("AppComponent:social done", Date.now() - t);
    }

    let settingNode;
    if (model.navigationModel.activeNav == "Setting") {
        settingNode = (
            <div
                class={tw`flex-1 overflow-hidden overflow-y-auto bg-[${SecondaryBackgroundColor}]`}
            >
                {Setting({
                    logout: app.logout,
                    relayConfig: app.relayConfig,
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
                        pool: app.relayConfig.pool,
                        allUserInfo: app.allUsersInfo.userInfos,
                        profilesSyncer: app.profileSyncer,
                        eventSyncer: app.eventSyncer,
                        focusedPlainTextEvent: model.focusedPlainTextEvent,
                    })}
                </div>
            );
        }

        if (model.navigationModel.activeNav == "About") {
            aboutNode = About();
        }
    }

    let popoverChildren;
    switch (model.popoverModel.type) {
        case "SearchUser":
            popoverChildren = Search({
                eventEmitter: props.eventBus,
                model: model.dm.search,
            });
            break;
        case "PlainTextEventDetail":
            popoverChildren = PlainTextEventDetail(model.focusedPlainTextEvent!);
            break;
    }

    console.debug("AppComponent:2", Date.now() - t);

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
                            pool: app.relayConfig.pool,
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
                    {
                        model.popoverModel.show
                        ? (
                            <Popover close={() => {
                                props.eventBus.emit({
                                    type: "ClosePopover"
                                });
                            }}>
                                {popoverChildren}
                            </Popover>
                        )
                        : undefined
                    }
                </div>

                <div class={tw`desktop:hidden`}>
                    <nav.MobileNavBar
                        profilePicURL={model.myProfile?.picture}
                        publicKey={myAccountCtx.publicKey}
                        database={app.database}
                        pool={app.relayConfig.pool}
                        eventEmitter={app.eventBus}
                        AddRelayButtonClickedError={model.AddRelayButtonClickedError}
                        AddRelayInput={model.AddRelayInput}
                        {...model.navigationModel}
                    />
                </div>
            </div>
        </div>
    );

    console.debug("AppComponent:end", Date.now() - t);
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
        const profileData = allUserInfo.get(focusedContent.hex)?.profile?.profile;
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
