/** @jsx h */
import { h, render, VNode } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { NostrAccountContext, NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { Database_View } from "../database.ts";
import { EventBus } from "../event-bus.ts";
import { DirectedMessageController, getAllEncryptedMessagesOf, InvalidEvent } from "../features/dm.ts";
import { About } from "./about.tsx";
import { initialModel, Model } from "./app_model.ts";
import { AppEventBus, Database_Update, UI_Interaction_Event, UI_Interaction_Update } from "./app_update.tsx";
import { Popover, PopOverInputChannel } from "./components/popover.tsx";
import { OtherConfig } from "./config-other.ts";
import { DM_List } from "./conversation-list.ts";
import { DexieDatabase } from "./dexie-db.ts";
import { DirectMessageContainer } from "./dm.tsx";
import { EditProfile } from "./edit-profile.tsx";
import { RelayConfig } from "./relay-config.ts";
import { ProfileGetter } from "./search.tsx";
import { Setting } from "./setting.tsx";
import { getCurrentSignInCtx, getSignInState, setSignInState } from "./sign-in.ts";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { LamportTime } from "../time.ts";
import { InstallPrompt, NavBar } from "./nav.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { ChannelContainer } from "./channel-container.tsx";
import { ChatMessage } from "./message.ts";
import { filter, map } from "./_helper.ts";
import { RightPanel } from "./components/right-panel.tsx";
import { ComponentChildren } from "https://esm.sh/preact@10.17.1";
import { SignIn } from "./sign-in.tsx";
import { getTags, Parsed_Event } from "../nostr.ts";

export async function Start(database: DexieDatabase) {
    console.log("Start the application");

    const installPrompt: InstallPrompt = {
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
    const rightPanelInputChan: Channel<() => ComponentChildren> = new Channel();
    const dbView = await Database_View.New(database, database, database);
    const newNostrEventChannel = new Channel<NostrEvent>();
    (async () => {
        for await (const event of newNostrEventChannel) {
            const err = await pool.sendEvent(event);
            if (err instanceof Error) {
                console.error(err);
            }
        }
    })();

    {
        for (;;) {
            if (getSignInState() === "none") {
                break;
            }
            const ctx = await getCurrentSignInCtx();
            if (ctx instanceof Error) {
                console.error(ctx);
                break;
            } else if (ctx) {
                const otherConfig = await OtherConfig.FromLocalStorage(ctx, newNostrEventChannel, lamport);
                const app = await App.Start({
                    database: dbView,
                    model,
                    ctx,
                    eventBus,
                    pool,
                    popOverInputChan,
                    rightPanelInputChan,
                    otherConfig,
                    lamport,
                    installPrompt,
                });
                model.app = app;
                break;
            }
        }
    }

    /* first render */ render(
        <AppComponent
            eventBus={eventBus}
            model={model}
            pool={pool}
            popOverInputChan={popOverInputChan}
            rightPanelInputChan={rightPanelInputChan}
            installPrompt={installPrompt}
        />,
        document.body,
    );

    for await (
        let ok of UI_Interaction_Update({
            model,
            eventBus,
            dbView: dbView,
            pool,
            popOver: popOverInputChan,
            rightPanel: rightPanelInputChan,
            newNostrEventChannel: newNostrEventChannel,
            lamport,
            installPrompt,
        })
    ) {
        if (ok == false) {
            continue;
        }
        const t = Date.now();
        {
            render(
                <AppComponent
                    eventBus={eventBus}
                    model={model}
                    pool={pool}
                    popOverInputChan={popOverInputChan}
                    rightPanelInputChan={rightPanelInputChan}
                    installPrompt={installPrompt}
                />,
                document.body,
            );
        }
        console.log("UI_Interaction_Update render:", Date.now() - t);
    }
}

export class App {
    private constructor(
        public readonly database: Database_View,
        public readonly model: Model,
        public readonly ctx: NostrAccountContext,
        public readonly eventBus: EventBus<UI_Interaction_Event>,
        public readonly pool: ConnectionPool,
        public readonly popOverInputChan: PopOverInputChannel,
        public readonly rightPanelInputChan: Channel<() => ComponentChildren>,
        public readonly otherConfig: OtherConfig,
        public readonly conversationLists: DM_List,
        public readonly relayConfig: RelayConfig,
        public readonly lamport: LamportTime,
        public readonly dmController: DirectedMessageController,
    ) {}

    static async Start(args: {
        database: Database_View;
        model: Model;
        ctx: NostrAccountContext;
        eventBus: EventBus<UI_Interaction_Event>;
        pool: ConnectionPool;
        popOverInputChan: PopOverInputChannel;
        rightPanelInputChan: Channel<() => ComponentChildren>;
        otherConfig: OtherConfig;
        lamport: LamportTime;
        installPrompt: InstallPrompt;
    }) {
        const all_events = Array.from(args.database.getAllEvents());
        args.lamport.fromEvents(all_events);

        // init relay config
        const relayConfig = await RelayConfig.FromLocalStorage({
            ctx: args.ctx,
            relayPool: args.pool,
        });
        console.log(relayConfig.getRelayURLs());

        // init conversation list
        const conversationLists = new DM_List(args.ctx);
        const err = conversationLists.addEvents(all_events, false);
        if (err instanceof InvalidEvent) {
            console.error(err);
            await args.database.remove(err.event.id);
        }

        const dmController = new DirectedMessageController(args.ctx);

        (async () => {
            // load DMs
            for (const e of all_events) {
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
        })();

        const app = new App(
            args.database,
            args.model,
            args.ctx,
            args.eventBus,
            args.pool,
            args.popOverInputChan,
            args.rightPanelInputChan,
            args.otherConfig,
            conversationLists,
            relayConfig,
            args.lamport,
            dmController,
        );
        await app.initApp(args.installPrompt);
        return app;
    }

    private initApp = async (installPrompt: InstallPrompt) => {
        console.log("App.initApp");

        // Sync events
        {
            forever(sync_client_specific_data(this.pool, this.ctx, this.database));
            forever(sync_dm_events(this.database, this.ctx, this.pool));
            forever(sync_profile_events(this.database, this.pool));
            forever(sync_kind_1(this.pool, this.database));
        }

        /* my profile */
        const myProfileEvent = this.database.getProfilesByPublicKey(this.ctx.publicKey);
        if (myProfileEvent != undefined) {
            this.model.myProfile = myProfileEvent.profile;
        }

        // Database
        (async () => {
            let i = 0;
            for await (
                let _ of Database_Update(
                    this.ctx,
                    this.database,
                    this.model,
                    this.lamport,
                    this.conversationLists,
                    this.dmController,
                    this.eventBus.emit,
                    {
                        otherConfig: this.otherConfig,
                    },
                )
            ) {
                const t = Date.now();
                render(
                    <AppComponent
                        eventBus={this.eventBus}
                        model={this.model}
                        pool={this.pool}
                        popOverInputChan={this.popOverInputChan}
                        rightPanelInputChan={this.rightPanelInputChan}
                        installPrompt={installPrompt}
                    />,
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

type AppProps = {
    model: Model;
    eventBus: AppEventBus;
    pool: ConnectionPool;
    popOverInputChan: PopOverInputChannel;
    rightPanelInputChan: Channel<() => ComponentChildren>;
    installPrompt: InstallPrompt;
};

export class AppComponent extends Component<AppProps> {
    events = this.props.eventBus.onChange();

    componentWillUnmount() {
        this.events.close();
    }

    render(props: AppProps) {
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
            if (model.navigationModel.activeNav == "DM" && model.currentRelay) {
                dmVNode = (
                    <DirectMessageContainer
                        {...model.dm}
                        bus={app.eventBus}
                        ctx={myAccountCtx}
                        getters={{
                            convoListRetriever: app.conversationLists,
                            messageGetter: app.dmController,
                            newMessageChecker: app.conversationLists,
                            relayRecordGetter: app.database,
                            pinListGetter: app.otherConfig,
                            profileGetter: app.database,
                            isUserBlocked: app.conversationLists.isUserBlocked,
                            getEventByID: app.database.getEventByID,
                        }}
                        userBlocker={app.conversationLists}
                    />
                );
            }

            if (model.navigationModel.activeNav == "About") {
                aboutNode = About(app.eventBus.emit);
            }
        }

        let socialNode: VNode | undefined;
        if (model.navigationModel.activeNav == "Social" && model.currentRelay) {
            socialNode = (
                <ChannelContainer
                    ctx={myAccountCtx}
                    {...model.social}
                    getters={{
                        convoListRetriever: app.conversationLists,
                        newMessageChecker: app.conversationLists,
                        relayRecordGetter: app.database,
                        profileGetter: app.database,
                        isUserBlocked: app.conversationLists.isUserBlocked,
                        getEventByID: app.database.getEventByID,
                    }}
                    messages={Array.from(
                        map(
                            filter(
                                app.database.getAllEvents(),
                                (e) => {
                                    if (e.kind != NostrKind.TEXT_NOTE) {
                                        return false;
                                    }
                                    const relays = app.database.getRelayRecord(e.id);
                                    return relays.has(model.currentRelay);
                                },
                            ),
                            (e) => {
                                const msg: ChatMessage = {
                                    author: e.publicKey,
                                    content: e.content,
                                    created_at: new Date(e.created_at * 1000),
                                    event: e as Parsed_Event<NostrKind.TEXT_NOTE>,
                                    lamport: getTags(e).lamport_timestamp,
                                    type: "text",
                                };
                                return msg;
                            },
                        ),
                    )}
                    relay={props.pool.getRelay(model.currentRelay) as SingleRelayConnection}
                    bus={app.eventBus}
                />
            );
        }

        console.debug("AppComponent:2", Date.now() - t);

        const final = (
            <div class={`h-screen w-full flex`}>
                <NavBar
                    publicKey={app.ctx.publicKey}
                    profile={app.database.getProfilesByPublicKey(myAccountCtx.publicKey)}
                    emit={app.eventBus.emit}
                    installPrompt={props.installPrompt}
                    currentRelay={model.currentRelay}
                    activeNav={model.navigationModel.activeNav}
                    pool={app.pool}
                />

                <div
                    class={`h-full px-[3rem] sm:px-4 bg-[${SecondaryBackgroundColor}] flex-1 overflow-auto${
                        model.navigationModel.activeNav == "Profile" ? " block" : " hidden"
                    }`}
                >
                    <div
                        class={`max-w-[35rem] h-full m-auto`}
                    >
                        <EditProfile
                            ctx={model.app.ctx}
                            profileGetter={app.database}
                            emit={props.eventBus.emit}
                        />
                    </div>
                </div>
                {socialNode}
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
                <RightPanel
                    inputChan={props.rightPanelInputChan}
                />
            </div>
        );

        console.debug("AppComponent:end", Date.now() - t);
        return final;
    }
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

async function sync_dm_events(
    database: Database_View,
    ctx: NostrAccountContext,
    pool: ConnectionPool,
) {
    const messageStream = getAllEncryptedMessagesOf(
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
}

async function sync_profile_events(
    database: Database_View,
    pool: ConnectionPool,
) {
    const messageStream = await pool.newSub("sync_profile_events", {
        kinds: [NostrKind.META_DATA],
    });
    if (messageStream instanceof Error) {
        return messageStream;
    }
    for await (const msg of messageStream.chan) {
        if (msg.res.type == "EVENT") {
            const err = await database.addEvent(msg.res.event, msg.url);
            if (err instanceof Error) {
                console.log(err);
            }
        }
    }
}

const sync_kind_1 = async (pool: ConnectionPool, database: Database_View) => {
    const stream = await pool.newSub("sync_kind_1", {
        kinds: [NostrKind.TEXT_NOTE],
    });
    if (stream instanceof Error) {
        return stream;
    }
    for await (const msg of stream.chan) {
        if (msg.res.type == "EOSE" || msg.res.type == "NOTICE") {
            continue;
        }
        const ok = await database.addEvent(msg.res.event, msg.url);
        if (ok instanceof Error) {
            console.error(msg);
            console.error(ok);
        }
    }
};

const sync_client_specific_data = async (
    pool: ConnectionPool,
    ctx: NostrAccountContext,
    database: Database_View,
) => {
    const stream = await pool.newSub(OtherConfig.name, {
        authors: [ctx.publicKey.hex],
        kinds: [NostrKind.Encrypted_Custom_App_Data],
    });
    if (stream instanceof Error) {
        throw stream; // crash the app
    }
    for await (const msg of stream.chan) {
        if (msg.res.type == "EOSE" || msg.res.type == "NOTICE") {
            continue;
        }
        const ok = await database.addEvent(msg.res.event, msg.url);
        if (ok instanceof Error) {
            console.error(msg.res.event);
            console.error(ok);
        }
    }
};

// f should not resolve, if it does resolve, it should only throw an error
async function forever(f: Promise<Error | undefined | void>) {
    const r = await f;
    if (r == undefined) {
        throw new Error(`${f} should not resolve`);
    }
    throw r;
}
