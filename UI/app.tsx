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
import { Database } from "../database.ts";

import { getAllUsersInformation, ProfilesSyncer, UserInfo } from "./contact-list.ts";

import { new_DM_EditorModel } from "./editor.tsx";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { initialModel, Model } from "./app_model.ts";
import { Database_Update, Relay_Update, UI_Interaction_Event, UI_Interaction_Update } from "./app_update.ts";
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
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { EventSyncer } from "./event_syncer.ts";
import { getRelayURLs } from "./setting.ts";

export async function Start(database: Database) {
    console.log("Start the application");
    const lamport = time.fromEvents(database.filterEvents((_) => true));
    const app = new App(database, lamport);
    const ctx = await getCurrentSignInCtx();
    console.log("Start:", ctx);
    if (ctx instanceof Error) {
        console.error(ctx);
        app.model.signIn.warningString = "Please add your private key to your NIP-7 extension";
    } else if (ctx) {
        app.myAccountContext = ctx;
        const err = await app.initApp(ctx);
        if (err instanceof Error) {
            throw err;
        }
    }

    const appComponent = AppComponent({ app });
    /* first render */ render(appComponent, document.body);

    for await (let _ of UI_Interaction_Update(app, app.profileSyncer, lamport)) {
        const t = Date.now();
        {
            const appComponent = AppComponent({ app });
            render(appComponent, document.body);
        }
        console.log("render", Date.now() - t);
    }

    (async () => {
        for await (let _ of Relay_Update(app.relayPool)) {
            const appComponent = AppComponent({ app });
            render(appComponent, document.body);
        }
    })();
}

async function initProfileSyncer(
    pool: ConnectionPool,
    accountContext: NostrAccountContext,
    database: db.Database,
) {
    const myPublicKey = accountContext.publicKey;

    ////////////////////
    // Init Core Data //
    ////////////////////
    const newestEvent = dm.getNewestEventOf(database, myPublicKey.hex);
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
    database.syncEvents(
        (_) => true,
        messageStream,
    );

    // Sync my profile events
    const profilesSyncer = new ProfilesSyncer(database, pool);
    await profilesSyncer.add(myPublicKey.hex);

    // Sync Custom App Data
    (async () => {
        const chan = new Channel<{ event: NostrEvent; url: string }>();
        let subId = newSubID();
        let resp = await pool.newSub(
            subId,
            {
                authors: [myPublicKey.hex],
                kinds: [NostrKind.CustomAppData],
                limit: 100, // todo: should use time
            },
        );
        if (resp instanceof Error) {
            throw resp;
        }
        (async () => {
            for await (let { res: nostrMessage, url: relayUrl } of resp) {
                if (nostrMessage.type === "EVENT" && nostrMessage.event.content) {
                    const event = nostrMessage.event;
                    const decryptedEvent = await decryptNostrEvent(
                        event,
                        accountContext,
                        accountContext.publicKey.hex,
                    );
                    if (decryptedEvent instanceof DecryptionFailure) {
                        console.error(decryptedEvent);
                        continue;
                    }
                    await chan.put({
                        event: decryptedEvent,
                        url: relayUrl,
                    });
                }
            }
            console.log("closed");
        })();
        return chan;
    })().then((customAppDataChan) => {
        database.syncEvents((e) => e.kind == NostrKind.CustomAppData, customAppDataChan);
    });

    ///////////////////////////////////
    // Add relays to Connection Pool //
    ///////////////////////////////////
    const relayURLs = getRelayURLs(database);
    pool.addRelayURLs(relayURLs);

    return profilesSyncer;
}

export class App {
    relayPool: ConnectionPool;
    myAccountContext: NostrAccountContext | undefined;
    eventBus = new EventBus<UI_Interaction_Event>();
    model: Model;
    profileSyncer!: ProfilesSyncer;
    eventSyncer: EventSyncer;

    constructor(
        public readonly database: Database,
        public readonly lamport: time.LamportTime,
    ) {
        this.model = initialModel();
        this.relayPool = new ConnectionPool();
        this.eventSyncer = new EventSyncer(this.relayPool, this.database);
    }

    initApp = async (accountContext: NostrAccountContext) => {
        console.log("App.initApp");
        const profilesSyncer = await initProfileSyncer(this.relayPool, accountContext, this.database);
        if (profilesSyncer instanceof Error) {
            return profilesSyncer;
        }

        this.profileSyncer = profilesSyncer;
        this.myAccountContext = accountContext;

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
                const appComponent = AppComponent({ app: this });
                render(appComponent, document.body);
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
    app: App;
}) {
    const t = Date.now();
    const app = props.app;
    const myAccountCtx = app.myAccountContext;
    if (myAccountCtx == undefined) {
        console.log("render sign in page");
        return (
            <SignIn
                eventBus={app.eventBus}
                {...app.model.signIn}
            />
        );
    }

    let socialPostsPanel: VNode | undefined;
    if (app.model.navigationModel.activeNav == "Social") {
        const allUserInfo = getAllUsersInformation(app.database, myAccountCtx);
        console.log("AppComponent:getSocialPosts before", Date.now() - t);
        const socialPosts = getSocialPosts(app.database, allUserInfo, myAccountCtx);
        console.log("AppComponent:getSocialPosts after", Date.now() - t, Date.now());
        let focusedContentGetter = () => {
            console.log("AppComponent:getFocusedContent before", Date.now() - t);
            let _ = getFocusedContent(app.model.social.focusedContent, allUserInfo, socialPosts);
            console.log("AppComponent:getFocusedContent", Date.now() - t);
            if (_?.type === "MessageThread") {
                let editor = app.model.social.replyEditors.get(_.data.root.root_event.id);
                if (editor == undefined) {
                    editor = {
                        id: _.data.root.root_event.id,
                        files: [],
                        text: "",
                        tags: [
                            ["e", _.data.root.root_event.id],
                        ],
                        target: {
                            kind: NostrKind.TEXT_NOTE,
                        },
                    };
                    app.model.social.replyEditors.set(editor.id, editor);
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
        const messagePanel = MessagePanel({
            focusedContent: focusedContent,
            editorModel: app.model.social.editor,
            // myPublicKey={myAccountCtx.publicKey}
            ctx: myAccountCtx,
            messages: socialPosts,
            rightPanelModel: app.model.rightPanelModel,
            db: app.database,
            eventEmitter: app.eventBus,
            profilesSyncer: app.profileSyncer,
            eventSyncer: app.eventSyncer,
        });

        socialPostsPanel = (
            <div
                class={tw`flex-1 overflow-hidden bg-[#313338]`}
            >
                {messagePanel instanceof Error ? messagePanel.message : messagePanel}
            </div>
        );
    }

    let settingNode;
    if (app.model.navigationModel.activeNav == "Setting") {
        settingNode = (
            <div
                class={tw`flex-1 overflow-hidden overflow-y-auto bg-[${SecondaryBackgroundColor}]`}
            >
                {Setting({
                    logout: app.logout,
                    pool: app.relayPool,
                    eventBus: app.eventBus,
                    AddRelayButtonClickedError: app.model.AddRelayButtonClickedError,
                    AddRelayInput: app.model.AddRelayInput,
                    myAccountContext: myAccountCtx,
                })}
            </div>
        );
    }

    let appList;
    if (app.model.navigationModel.activeNav == "AppList") {
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
        app.model.navigationModel.activeNav == "DM" ||
        app.model.navigationModel.activeNav == "About"
    ) {
        const allUserInfo = getAllUsersInformation(app.database, myAccountCtx);
        if (app.model.navigationModel.activeNav == "DM") {
            const directMessageContainer = DirectMessageContainer({
                editors: app.model.editors,
                ...app.model.dm,
                rightPanelModel: app.model.rightPanelModel,
                eventEmitter: app.eventBus,
                myAccountContext: myAccountCtx,
                db: app.database,
                pool: props.app.relayPool,
                allUserInfo: allUserInfo,
                profilesSyncer: app.profileSyncer,
                eventSyncer: app.eventSyncer,
            });
            // if(directMessageContainer instanceof Error) {
            //     return directMessageContainer
            // }
            console.log("app:directMessageContainer", directMessageContainer);
            dmVNode = (
                <div
                    class={tw`flex-1 overflow-hidden`}
                >
                    {directMessageContainer instanceof Error
                        ? directMessageContainer.message
                        : directMessageContainer}
                </div>
            );
        }

        if (app.model.navigationModel.activeNav == "About") {
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
                            profilePicURL: app.model.myProfile?.picture,
                            publicKey: myAccountCtx.publicKey,
                            database: app.database,
                            pool: app.relayPool,
                            eventEmitter: app.eventBus,
                            AddRelayButtonClickedError: app.model.AddRelayButtonClickedError,
                            AddRelayInput: app.model.AddRelayInput,
                            ...app.model.navigationModel,
                        })}
                    </div>

                    <div
                        class={tw`h-full px-[3rem] bg-[${SecondaryBackgroundColor}] flex-1 overflow-auto${
                            app.model.navigationModel.activeNav == "Profile" ? " block" : " hidden"
                        }`}
                    >
                        <div
                            class={tw`max-w-[35rem] h-full m-auto`}
                        >
                            {EditProfile({
                                eventEmitter: app.eventBus,
                                myProfile: app.model.myProfile,
                                newProfileField: app.model.newProfileField,
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
                        profilePicURL={app.model.myProfile?.picture}
                        publicKey={myAccountCtx.publicKey}
                        database={app.database}
                        pool={app.relayPool}
                        eventEmitter={app.eventBus}
                        AddRelayButtonClickedError={app.model.AddRelayButtonClickedError}
                        AddRelayInput={app.model.AddRelayInput}
                        {...app.model.navigationModel}
                    />
                </div>
            </div>
        </div>
    );

    console.debug("App:end", Date.now() - t);
    return final;
}

function About() {
    return (
        <div
            class={tw`flex-1 overflow-hidden bg-[#313338] text-[#FFFFFF]`}
        >
            <p>Blowater is delightful DM focusing Nostr client.</p>

            <p>
                It's here to replace Telegram/Slack/Discord alike centralized chat apps and give users a
                strong privacy, globally available decentralized chat app.
            </p>

            <p>Authors</p>
            <ul>
                <li>Water Blowater npub1dww6jgxykmkt7tqjqx985tg58dxlm7v83sa743578xa4j7zpe3hql6pdnf</li>
            </ul>

            <div>Donation Lightning: blowater@getalby.com</div>

            <div>
                Customer Support Support Bot: npub1fdjk8cz47lzmcruean82cfufefkf4gja9hrs90tyysemm5p7vt7s9knc27
            </div>
        </div>
    );
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
            if (thread.root.root_event.id == focusedContent.id) {
                return {
                    type: "MessageThread" as "MessageThread",
                    data: thread,
                };
            }
        }
    }
}
