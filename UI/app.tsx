/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import * as dm from "../features/dm.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { tw } from "https://esm.sh/twind@0.16.16";
import { EditProfile } from "./edit-profile.tsx";
import * as nav from "./nav.tsx";
import { EventBus } from "../event-bus.ts";
import { Setting } from "./setting.tsx";
import { Database_Contextual_View } from "../database.ts";
import { ConversationLists } from "./conversation-list.ts";
import { new_DM_EditorModel } from "./editor.tsx";
import { initialModel, Model } from "./app_model.ts";
import { AppEventBus, Database_Update, UI_Interaction_Event, UI_Interaction_Update } from "./app_update.tsx";
import * as time from "../time.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay.ts";
import { getCurrentSignInCtx, setSignInState, SignIn } from "./signIn.tsx";
import { AppList } from "./app-list.tsx";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { EventSyncer } from "./event_syncer.ts";
import { defaultRelays, RelayConfig } from "./relay-config.ts";
import { DexieDatabase } from "./dexie-db.ts";
import { About } from "./about.tsx";
import { ProfileSyncer } from "../features/profile.ts";
import { Popover, PopOverInputChannel } from "./components/popover.tsx";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { GroupChatController } from "../group-chat.ts";
import { OtherConfig } from "./config-other.ts";
import { ProfileGetter } from "./search.tsx";
import { ZodError } from "https://esm.sh/zod@3.22.4";
import { data } from "./_setup.test.ts";

export async function Start(database: DexieDatabase) {
    console.log("Start the application");

    const model = initialModel();
    const eventBus = new EventBus<UI_Interaction_Event>();
    const pool = new ConnectionPool();
    const popOverInputChan: PopOverInputChannel = new Channel();

    const ctx = await getCurrentSignInCtx();
    if (ctx instanceof Error) {
        console.error(ctx);
        model.signIn.warningString = "Please add your private key to your NIP-7 extension";
    } else if (ctx) {
        const dbView = await Database_Contextual_View.New(database, ctx);
        if (dbView instanceof Error) {
            throw dbView;
        }
        const lamport = time.fromEvents(dbView.events);
        const otherConfig = await OtherConfig.FromLocalStorage(ctx);
        const app = new App(dbView, lamport, model, ctx, eventBus, pool, popOverInputChan, otherConfig);
        await app.initApp();
        model.app = app;
    }

    /* first render */ render(
        AppComponent({
            eventBus,
            model,
            pool,
            popOverInputChan,
        }),
        document.body,
    );

    for await (
        let _ of UI_Interaction_Update({
            model,
            eventBus,
            dexieDB: database,
            pool,
            popOver: popOverInputChan,
        })
    ) {
        const t = Date.now();
        {
            render(
                AppComponent({
                    eventBus,
                    model,
                    pool,
                    popOverInputChan,
                }),
                document.body,
            );
        }
        console.log("UI_Interaction_Update render:", Date.now() - t);
    }
}

export class App {
    readonly profileSyncer: ProfileSyncer;
    readonly eventSyncer: EventSyncer;
    public readonly conversationLists: ConversationLists;
    public readonly relayConfig: RelayConfig;
    public readonly groupChatController: GroupChatController;

    constructor(
        public readonly database: Database_Contextual_View,
        public readonly lamport: time.LamportTime,
        public readonly model: Model,
        public readonly ctx: NostrAccountContext,
        public readonly eventBus: EventBus<UI_Interaction_Event>,
        public readonly pool: ConnectionPool,
        public readonly popOverInputChan: PopOverInputChannel,
        public readonly otherConfig: OtherConfig,
    ) {
        this.eventSyncer = new EventSyncer(pool, this.database);
        this.relayConfig = RelayConfig.FromLocalStorage(ctx);
        if (this.relayConfig.getRelayURLs().size == 0) {
            for (const url of defaultRelays) {
                this.relayConfig.add(url);
            }
        }
        this.profileSyncer = new ProfileSyncer(this.database, pool);
        this.profileSyncer.add(ctx.publicKey.hex);

        this.conversationLists = new ConversationLists(ctx, this.profileSyncer);
        this.conversationLists.addEvents(database.events);

        this.groupChatController = new GroupChatController(ctx, this.conversationLists);
    }

    initApp = async () => {
        console.log("App.initApp");

        ///////////////////////////////////
        // Add relays to Connection Pool //
        ///////////////////////////////////
        // relay config synchronization, need to refactor later
        (async () => {
            const err = await this.relayConfig.syncWithPool(this.pool);
            if (err instanceof Error) {
                throw err; // don't know what to do, should crash the app
            }
            const stream = await this.pool.newSub("relay config", {
                "#d": ["RelayConfig"],
                authors: [this.ctx.publicKey.hex],
                kinds: [NostrKind.Custom_App_Data],
            });
            if (stream instanceof Error) {
                throw stream; // impossible
            }
            for await (const msg of stream.chan) {
                if (msg.res.type == "EOSE") {
                    continue;
                }
                console.log(msg.res);
                RelayConfig.FromNostrEvent(msg.res.event, this.ctx);
                const _relayConfig = await RelayConfig.FromNostrEvent(
                    msg.res.event,
                    this.ctx,
                );
                if (_relayConfig instanceof Error) {
                    console.log(_relayConfig.message);
                    continue;
                }
                this.relayConfig.merge(_relayConfig.save());
                this.relayConfig.saveToLocalStorage(this.ctx);
            }
        })();

        this.otherConfig.syncFromRelay(this.pool, this.ctx);

        // group chat synchronization
        (async () => {
            const stream = await this.pool.newSub("group chat", {
                authors: [this.ctx.publicKey.hex],
                kinds: [NostrKind.Group_Message],
            });
            if (stream instanceof Error) {
                throw stream; // crash the app
            }
            for await (const msg of stream.chan) {
                if (msg.res.type == "EOSE") {
                    continue;
                }
                const ok = await this.database.addEvent(msg.res.event);
                if (ok instanceof Error) {
                    if (ok instanceof ZodError) {
                        continue;
                    }
                    console.error(msg.res.event);
                    console.error(ok);
                }
            }
        })();
        // Sync DM events
        (async function sync_dm_events(
            database: Database_Contextual_View,
            ctx: NostrAccountContext,
            pool: ConnectionPool,
        ) {
            const messageStream = dm.getAllEncryptedMessagesOf(
                ctx.publicKey,
                pool,
            );
            for await (const msg of messageStream) {
                if (msg.res.type == "EVENT") {
                    const err = await database.addEvent(msg.res.event);
                    if (err instanceof Error) {
                        console.log(err);
                    }
                }
            }
        })(this.database, this.ctx, this.pool);

        /* my profile */
        this.model.myProfile = this.conversationLists.convoSummaries.get(this.ctx.publicKey.hex)?.profile
            ?.profile;

        /* contacts */
        for (const contact of this.conversationLists.convoSummaries.values()) {
            const editor = this.model.editors.get(contact.pubkey.hex);
            if (editor == null) {
                const pubkey = PublicKey.FromHex(contact.pubkey.hex);
                if (pubkey instanceof Error) {
                    throw pubkey; // impossible
                }
                this.model.editors.set(
                    contact.pubkey.hex,
                    new_DM_EditorModel(
                        pubkey,
                    ),
                );
            }
        }

        this.profileSyncer.add(
            ...Array.from(this.conversationLists.convoSummaries.keys()),
        );
        console.log("user set", this.profileSyncer.userSet);

        // Database
        (async () => {
            let i = 0;
            for await (
                let _ of Database_Update(
                    this.ctx,
                    this.database,
                    this.model,
                    this.profileSyncer,
                    this.lamport,
                    this.conversationLists,
                    this.groupChatController,
                )
            ) {
                const t = Date.now();
                render(
                    AppComponent({
                        eventBus: this.eventBus,
                        model: this.model,
                        pool: this.pool,
                        popOverInputChan: this.popOverInputChan,
                    }),
                    document.body,
                );
                console.log(`Database_Update: render ${++i} times, ${Date.now() - t}`);
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
    pool: ConnectionPool;
    popOverInputChan: PopOverInputChannel;
}) {
    const t = Date.now();
    const model = props.model;

    if (model.app == undefined) {
        console.log("render sign in page");
        return (
            <SignIn
                eventBus={props.eventBus}
                privateKey={model.signIn.privateKey}
                warningString={model.signIn.warningString}
            />
        );
    }

    const app = model.app;
    const myAccountCtx = model.app.ctx;

    let settingNode;
    if (model.navigationModel.activeNav == "Setting") {
        settingNode = (
            <div
                class={tw`flex-1 overflow-hidden overflow-y-auto`}
            >
                {Setting({
                    logout: app.logout,
                    relayConfig: app.relayConfig,
                    myAccountContext: myAccountCtx,
                    relayPool: props.pool,
                    emit: props.eventBus.emit,
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
                        ...model.dm,
                        rightPanelModel: model.rightPanelModel,
                        bus: app.eventBus,
                        ctx: myAccountCtx,
                        dmGetter: app.database,
                        profileGetter: app.database,
                        pool: props.pool,
                        conversationLists: app.conversationLists,
                        profilesSyncer: app.profileSyncer,
                        eventSyncer: app.eventSyncer,
                        pinListGetter: app.otherConfig,
                        groupChatController: app.groupChatController,
                        newMessageChecker: app.conversationLists,
                        gmGetter: app.groupChatController,
                    })}
                </div>
            );
        }

        if (model.navigationModel.activeNav == "About") {
            aboutNode = About();
        }
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
                            pool: props.pool,
                            emit: app.eventBus.emit,
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
                                emit: app.eventBus.emit,
                                myProfile: model.myProfile,
                                newProfileField: model.newProfileField,
                            })}
                        </div>
                    </div>
                    {dmVNode}
                    {aboutNode}
                    {settingNode}
                    {/* {socialPostsPanel} */}
                    {appList}
                    <Popover
                        inputChan={props.popOverInputChan}
                    />
                </div>

                <div class={tw`desktop:hidden`}>
                    {
                        <nav.MobileNavBar
                            profilePicURL={model.myProfile?.picture}
                            publicKey={myAccountCtx.publicKey}
                            database={app.database}
                            pool={props.pool}
                            emit={app.eventBus.emit}
                            {...model.navigationModel}
                        />
                    }
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
    profileGetter: ProfileGetter,
) {
    if (focusedContent == undefined) {
        return;
    }
    if (focusedContent instanceof PublicKey) {
        const profileData = profileGetter.getProfilesByPublicKey(focusedContent)?.profile;
        return {
            type: "ProfileData" as "ProfileData",
            data: profileData,
            pubkey: focusedContent,
        };
    }
}
