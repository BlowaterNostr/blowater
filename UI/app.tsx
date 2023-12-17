/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import * as dm from "../features/dm.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { tw } from "https://esm.sh/twind@0.16.16";
import { EditProfile } from "./edit-profile.tsx";
import * as nav from "./nav.tsx";
import { EventBus } from "../event-bus.ts";
import { Setting } from "./setting.tsx";
import { Datebase_View } from "../database.ts";
import { DM_List } from "./conversation-list.ts";
import { new_DM_EditorModel } from "./editor.tsx";
import { initialModel, Model } from "./app_model.ts";
import { AppEventBus, Database_Update, UI_Interaction_Event, UI_Interaction_Update } from "./app_update.tsx";
import * as time from "../time.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../lib/nostr-ts/nostr.ts";
import { getCurrentSignInCtx, setSignInState, SignIn } from "./signIn.tsx";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { EventSyncer } from "./event_syncer.ts";
import { RelayConfig } from "./relay-config.ts";
import { DexieDatabase } from "./dexie-db.ts";
import { About } from "./about.tsx";
import { ProfileSyncer } from "../features/profile.ts";
import { Popover, PopOverInputChannel } from "./components/popover.tsx";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { group_GM_events, GroupChatSyncer, GroupMessageController } from "../features/gm.ts";
import { OtherConfig } from "./config-other.ts";
import { ProfileGetter } from "./search.tsx";
import { DirectedMessageController } from "../features/dm.ts";
import { ConnectionPool } from "../lib/nostr-ts/relay-pool.ts";
import { LamportTime } from "../time.ts";

export async function Start(database: DexieDatabase) {
    console.log("Start the application");

    const installPrompt: nav.InstallPrompt = {
        event: undefined,
    };
    window.addEventListener("beforeinstallprompt", async (event) => {
        event.preventDefault();
        installPrompt.event = event;
    });

    const lamport = new LamportTime();
    const model = initialModel();
    const eventBus = new EventBus<UI_Interaction_Event>();
    const pool = new ConnectionPool();
    const popOverInputChan: PopOverInputChannel = new Channel();
    const dbView = await Datebase_View.New(database, database, database);
    const newNostrEventChannel = new Channel<NostrEvent>();
    (async () => {
        for await (const event of newNostrEventChannel) {
            const err = await pool.sendEvent(event);
            if (err instanceof Error) {
                console.error(err);
            }
        }
    })();

    const ctx = await getCurrentSignInCtx();
    if (ctx instanceof Error) {
        console.error(ctx);
    } else if (ctx) {
        const otherConfig = await OtherConfig.FromLocalStorage(ctx, newNostrEventChannel, lamport);
        const app = await App.Start({
            database: dbView,
            model,
            ctx,
            eventBus,
            pool,
            popOverInputChan,
            otherConfig,
            lamport,
            installPrompt,
        });
        model.app = app;
    }

    /* first render */ render(
        AppComponent({
            eventBus,
            model,
            pool,
            popOverInputChan,
            installPrompt,
        }),
        document.body,
    );

    for await (
        let _ of UI_Interaction_Update({
            model,
            eventBus,
            dbView: dbView,
            pool,
            popOver: popOverInputChan,
            newNostrEventChannel: newNostrEventChannel,
            lamport,
            installPrompt,
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
                    installPrompt,
                }),
                document.body,
            );
        }
        console.log("UI_Interaction_Update render:", Date.now() - t);
    }
}

export class App {
    private constructor(
        public readonly database: Datebase_View,
        public readonly model: Model,
        public readonly ctx: NostrAccountContext,
        public readonly eventBus: EventBus<UI_Interaction_Event>,
        public readonly pool: ConnectionPool,
        public readonly popOverInputChan: PopOverInputChannel,
        public readonly otherConfig: OtherConfig,
        public readonly profileSyncer: ProfileSyncer,
        public readonly eventSyncer: EventSyncer,
        public readonly conversationLists: DM_List,
        public readonly relayConfig: RelayConfig,
        public readonly groupChatController: GroupMessageController,
        public readonly lamport: time.LamportTime,
        public readonly dmController: DirectedMessageController,
    ) {}

    static async Start(args: {
        database: Datebase_View;
        model: Model;
        ctx: NostrAccountContext;
        eventBus: EventBus<UI_Interaction_Event>;
        pool: ConnectionPool;
        popOverInputChan: PopOverInputChannel;
        otherConfig: OtherConfig;
        lamport: LamportTime;
        installPrompt: nav.InstallPrompt;
    }) {
        args.lamport.fromEvents(args.database.getAllEvents());
        const eventSyncer = new EventSyncer(args.pool, args.database);

        // init relay config
        const relayConfig = await RelayConfig.FromLocalStorage({
            ctx: args.ctx,
            relayPool: args.pool,
        });
        console.log(relayConfig.getRelayURLs());

        // init profile syncer
        const profileSyncer = new ProfileSyncer(args.database, args.pool);
        profileSyncer.add(args.ctx.publicKey.hex);

        // init conversation list
        const conversationLists = new DM_List(args.ctx);
        conversationLists.addEvents(Array.from(args.database.getAllEvents()));

        const dmController = new DirectedMessageController(args.ctx);
        const groupSyncer = new GroupChatSyncer(args.database, args.pool);
        const groupChatController = new GroupMessageController(
            args.ctx,
            groupSyncer,
            profileSyncer,
        );

        (async () => {
            // load DMs
            for (const e of args.database.getAllEvents()) {
                if (e.kind == NostrKind.DIRECT_MESSAGE) {
                    const error = await dmController.addEvent({
                        ...e,
                        kind: e.kind,
                    });
                    if (error instanceof Error) {
                        console.error(error.message);
                        await args.database.remove(e.id);
                    }
                } else {
                    continue;
                }
            }
            // load GMs
            const group_events = await group_GM_events(args.ctx, Array.from(args.database.getAllEvents()));
            for (const e of group_events.creataions) {
                const error = await groupChatController.addEvent(e);
                if (error instanceof Error) {
                    console.error(error, e);
                    await args.database.remove(e.id);
                }
            }
            for (const e of group_events.invites) {
                const error = await groupChatController.addEvent(e);
                if (error instanceof Error) {
                    console.error(error, e);
                    await args.database.remove(e.id);
                }
            }
            for (const e of group_events.messages) {
                const error = await groupChatController.addEvent(e);
                if (error instanceof Error) {
                    console.error(error, e);
                    await args.database.remove(e.id);
                }
            }
        })();

        const app = new App(
            args.database,
            args.model,
            args.ctx,
            args.eventBus,
            args.pool,
            args.popOverInputChan,
            args.otherConfig,
            profileSyncer,
            eventSyncer,
            conversationLists,
            relayConfig,
            groupChatController,
            args.lamport,
            dmController,
        );
        await app.initApp(args.installPrompt);
        return app;
    }

    private initApp = async (installPrompt: nav.InstallPrompt) => {
        console.log("App.initApp");

        // configurations: pin list
        (async () => {
            const stream = await this.pool.newSub(OtherConfig.name, {
                authors: [this.ctx.publicKey.hex],
                kinds: [NostrKind.Encrypted_Custom_App_Data],
            });
            if (stream instanceof Error) {
                throw stream; // crash the app
            }
            for await (const msg of stream.chan) {
                if (msg.res.type == "EOSE") {
                    continue;
                }
                const ok = await this.database.addEvent(msg.res.event, msg.url);
                if (ok instanceof Error) {
                    console.error(msg.res.event);
                    console.error(ok);
                }
            }
        })();

        // group chat synchronization
        (async () => {
            const stream = await this.pool.newSub("gm_send", {
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
                const ok = await this.database.addEvent(msg.res.event, msg.url);
                if (ok instanceof Error) {
                    console.error(msg.res.event);
                    console.error(ok);
                }
            }
        })();
        (async () => {
            const stream = await this.pool.newSub("gm_receive", {
                "#p": [this.ctx.publicKey.hex],
                kinds: [NostrKind.Group_Message],
            });
            if (stream instanceof Error) {
                throw stream; // crash the app
            }
            for await (const msg of stream.chan) {
                if (msg.res.type == "EOSE") {
                    continue;
                }
                const ok = await this.database.addEvent(msg.res.event, msg.url);
                if (ok instanceof Error) {
                    console.error(msg.res.event);
                    console.error(ok);
                }
            }
        })();

        // Sync DM events
        (async function sync_dm_events(
            database: Datebase_View,
            ctx: NostrAccountContext,
            pool: ConnectionPool,
        ) {
            const messageStream = dm.getAllEncryptedMessagesOf(
                ctx.publicKey,
                pool,
            );
            for await (const msg of messageStream) {
                if (msg.res.type == "EVENT") {
                    const err = await database.addEvent(msg.res.event, msg.url);
                    if (err instanceof Error) {
                        console.log(err);
                    }
                }
            }
        })(this.database, this.ctx, this.pool);

        /* my profile */
        const myProfileEvent = this.database.getProfilesByPublicKey(this.ctx.publicKey);
        if (myProfileEvent != undefined) {
            this.model.myProfile = myProfileEvent.profile;
        }

        /* contacts */
        for (const contact of this.conversationLists.convoSummaries.values()) {
            const editor = this.model.dmEditors.get(contact.pubkey.hex);
            if (editor == null) {
                const pubkey = PublicKey.FromHex(contact.pubkey.hex);
                if (pubkey instanceof Error) {
                    throw pubkey; // impossible
                }
                this.model.dmEditors.set(
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
                    this.dmController,
                    this.eventBus.emit,
                    {
                        otherConfig: this.otherConfig,
                    },
                )
            ) {
                const t = Date.now();
                render(
                    AppComponent({
                        eventBus: this.eventBus,
                        model: this.model,
                        pool: this.pool,
                        popOverInputChan: this.popOverInputChan,
                        installPrompt: installPrompt,
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
    installPrompt: nav.InstallPrompt;
}) {
    const t = Date.now();
    const model = props.model;

    if (model.app == undefined) {
        console.log("render sign in page");
        return <SignIn emit={props.eventBus.emit} />;
    }

    const app = model.app;
    const myAccountCtx = model.app.ctx;

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
                        profileGetter: app.database,
                        pool: props.pool,
                        conversationLists: app.conversationLists,
                        profilesSyncer: app.profileSyncer,
                        eventSyncer: app.eventSyncer,
                        pinListGetter: app.otherConfig,
                        groupChatController: app.groupChatController,
                        newMessageChecker: app.conversationLists,
                        messageGetter: model.dm.isGroupMessage ? app.groupChatController : app.dmController,
                        newMessageListener: model.dm.isGroupMessage
                            ? app.groupChatController
                            : app.dmController,
                        relayRecordGetter: app.database,
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
                        <nav.NavBar
                            publicKey={app.ctx.publicKey}
                            profileGetter={app.database}
                            emit={app.eventBus.emit}
                            installPrompt={props.installPrompt}
                        />
                    </div>

                    <div
                        class={tw`h-full px-[3rem] mobile:px-4 bg-[${SecondaryBackgroundColor}] flex-1 overflow-auto${
                            model.navigationModel.activeNav == "Profile" ? " block" : " hidden"
                        }`}
                    >
                        <div
                            class={tw`max-w-[35rem] h-full m-auto`}
                        >
                            <EditProfile
                                ctx={model.app.ctx}
                                profileGetter={app.database}
                                emit={props.eventBus.emit}
                            />
                        </div>
                    </div>
                    {dmVNode}
                    {aboutNode}
                    {Setting({
                        show: model.navigationModel.activeNav == "Setting",
                        logout: app.logout,
                        relayConfig: app.relayConfig,
                        myAccountContext: myAccountCtx,
                        relayPool: props.pool,
                        emit: props.eventBus.emit,
                    })}
                    <Popover
                        inputChan={props.popOverInputChan}
                    />
                </div>

                <div class={tw`desktop:hidden`}>
                    {!model.dm.currentEditor
                        ? (
                            <nav.NavBar
                                publicKey={app.ctx.publicKey}
                                profileGetter={app.database}
                                emit={app.eventBus.emit}
                                isMobile={true}
                                installPrompt={props.installPrompt}
                            />
                        )
                        : <div class={tw`h-4 bg-[#36393F]`}></div>}
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
