/** @jsx h */
import { h, render, VNode } from "preact";
import { Channel } from "@blowater/csp";

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
import { Setting } from "./setting.tsx";
import { getCurrentSignInCtx, getSignInState, setSignInState } from "./sign-in.ts";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { LamportTime } from "../time.ts";
import { InstallPrompt, NavBar } from "./nav.tsx";
import { Component } from "preact";
import { PublicMessageContainer } from "./public-message-container.tsx";
import { ChatMessage } from "./message.ts";
import { filter, forever, map } from "./_helper.ts";
import { RightPanel } from "./components/right-panel.tsx";
import { SignIn } from "./sign-in.tsx";
import { getTags, Parsed_Event } from "../nostr.ts";
import { Toast } from "./components/toast.tsx";
import { ToastChannel } from "./components/toast.tsx";
import { RightPanelChannel } from "./components/right-panel.tsx";
import { Modal, ModalInputChannel } from "./components/modal.tsx";
import { func_IsAdmin } from "./message-list.tsx";
import {
    ConnectionPool,
    getRelayInformation,
    InvalidKey,
    NostrAccountContext,
    NostrKind,
    PublicKey,
} from "@blowater/nostr-sdk";

export async function Start(database: DexieDatabase) {
    console.log("Start the application");

    const installPrompt: InstallPrompt = {
        event: undefined,
    };
    globalThis.addEventListener("beforeinstallprompt", async (event) => {
        event.preventDefault();
        installPrompt.event = event;
    });

    const lamport = new LamportTime();
    const model = initialModel();
    const eventBus = new EventBus<UI_Interaction_Event>();
    const popOverInputChan: PopOverInputChannel = new Channel();
    const rightPanelInputChan: RightPanelChannel = new Channel();
    const modalInputChan: ModalInputChannel = new Channel();
    const toastInputChan: ToastChannel = new Channel();
    const dbView = await Database_View.New(database, database, database);

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
                const otherConfig = await OtherConfig.FromLocalStorage(ctx, lamport);
                const app = await App.Start({
                    database: dbView,
                    model,
                    ctx,
                    eventBus,
                    pool: new ConnectionPool({ signer: ctx }),
                    popOverInputChan,
                    rightPanelInputChan,
                    modalInputChan,
                    otherConfig,
                    lamport,
                    installPrompt,
                    toastInputChan,
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
            popOverInputChan={popOverInputChan}
            rightPanelInputChan={rightPanelInputChan}
            modalInputChan={modalInputChan}
            installPrompt={installPrompt}
            toastInputChan={toastInputChan}
        />,
        document.body,
    );

    for await (
        let _ of UI_Interaction_Update({
            model,
            eventBus,
            dbView: dbView,
            popOver: popOverInputChan,
            rightPanel: rightPanelInputChan,
            modal: modalInputChan,
            lamport,
            installPrompt,
            toastInputChan: toastInputChan,
        })
    ) {
        const t = Date.now();
        {
            render(
                <AppComponent
                    eventBus={eventBus}
                    model={model}
                    popOverInputChan={popOverInputChan}
                    rightPanelInputChan={rightPanelInputChan}
                    modalInputChan={modalInputChan}
                    installPrompt={installPrompt}
                    toastInputChan={toastInputChan}
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
        public readonly rightPanelInputChan: RightPanelChannel,
        public readonly modalInputChan: ModalInputChannel,
        public readonly otherConfig: OtherConfig,
        public readonly conversationLists: DM_List,
        public readonly relayConfig: RelayConfig,
        public readonly lamport: LamportTime,
        public readonly dmController: DirectedMessageController,
        public readonly toastInputChan: ToastChannel,
    ) {}

    static async Start(args: {
        database: Database_View;
        model: Model;
        ctx: NostrAccountContext;
        eventBus: EventBus<UI_Interaction_Event>;
        pool: ConnectionPool;
        popOverInputChan: PopOverInputChannel;
        rightPanelInputChan: RightPanelChannel;
        modalInputChan: ModalInputChannel;
        otherConfig: OtherConfig;
        lamport: LamportTime;
        installPrompt: InstallPrompt;
        toastInputChan: ToastChannel;
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
                        if (error instanceof InvalidKey) {
                            await args.database.remove(e.id);
                        }
                    }
                } else {
                    continue;
                }
            }
            // Sync DM events after loaded DMs
            const lastestMessage = dmController.getLatestMessage();
            const since = lastestMessage ? lastestMessage.created_at.getTime() / 1000 : undefined;
            forever(sync_dm_events(args.ctx, {
                database: args.database,
                pool: args.pool,
                since,
            }));
        })();

        // Sync events since latest event in the database or beginning of time
        {
            const latestProfile = args.database.getLatestEvent(NostrKind.META_DATA);
            const latestPublic = args.database.getLatestEvent(NostrKind.TEXT_NOTE);
            const latestDeletion = args.database.getLatestEvent(NostrKind.DELETE);
            const latestReaction = args.database.getLatestEvent(NostrKind.REACTION);

            // NOTE:
            // 48 hours ago is because the latestEvent now does not distinguish space(relay).
            // After adding space, it can be subscribed to as the most recent timestamp.
            // So adding "hours ago" can at least have some content.
            forever(sync_profile_events({
                database: args.database,
                pool: args.pool,
                since: latestProfile ? hours_ago(latestProfile.created_at, 48) : undefined,
            }));
            forever(sync_public_notes({
                pool: args.pool,
                database: args.database,
                since: latestPublic ? hours_ago(latestPublic.created_at, 48) : undefined,
            }));
            forever(sync_deletion_events({
                pool: args.pool,
                database: args.database,
                since: latestDeletion ? hours_ago(latestDeletion.created_at, 48) : undefined,
            }));
            forever(sync_reaction_events({
                pool: args.pool,
                database: args.database,
                since: latestReaction ? hours_ago(latestReaction.created_at, 48) : undefined,
            }));
            sync_space_members(args.pool, args.database);
        }

        const app = new App(
            args.database,
            args.model,
            args.ctx,
            args.eventBus,
            args.pool,
            args.popOverInputChan,
            args.rightPanelInputChan,
            args.modalInputChan,
            args.otherConfig,
            conversationLists,
            relayConfig,
            args.lamport,
            dmController,
            args.toastInputChan,
        );
        await app.initApp(args.installPrompt);
        return app;
    }

    private initApp = async (installPrompt: InstallPrompt) => {
        console.log("App.initApp");

        // Sync event limit one
        {
            forever(sync_client_specific_data(this.pool, this.ctx, this.database));
        }

        (async () => {
            render(
                <AppComponent
                    eventBus={this.eventBus}
                    model={this.model}
                    popOverInputChan={this.popOverInputChan}
                    rightPanelInputChan={this.rightPanelInputChan}
                    modalInputChan={this.modalInputChan}
                    installPrompt={installPrompt}
                    toastInputChan={this.toastInputChan}
                />,
                document.body,
            );
        })();

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
                        popOverInputChan={this.popOverInputChan}
                        rightPanelInputChan={this.rightPanelInputChan}
                        modalInputChan={this.modalInputChan}
                        installPrompt={installPrompt}
                        toastInputChan={this.toastInputChan}
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
    popOverInputChan: PopOverInputChannel;
    rightPanelInputChan: RightPanelChannel;
    modalInputChan: ModalInputChannel;
    toastInputChan: ToastChannel;
    installPrompt: InstallPrompt;
};

export class AppComponent extends Component<AppProps, {
    isAdmin: func_IsAdmin | undefined;
    admin: string | undefined;
}> {
    state = {
        isAdmin: undefined,
        admin: undefined,
    };

    async componentDidMount() {
        await this.updateAdminState();
        for await (const update of this.props.eventBus.onChange()) {
            if (update.type == "SelectSpace") {
                this.updateAdminState();
            }
        }
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
                            getProfileByPublicKey: app.database.getProfileByPublicKey,
                            getProfilesByText: app.database.getProfilesByText,
                            isUserBlocked: app.conversationLists.isUserBlocked,
                            getEventByID: app.database.getEventByID,
                            isAdmin: this.state.isAdmin,
                            getReactionsByEventID: app.database.getReactionEvents,
                        }}
                        userBlocker={app.conversationLists}
                    />
                );
            }

            if (model.navigationModel.activeNav == "About") {
                aboutNode = About(app.eventBus.emit);
            }
        }

        let publicNode: VNode | undefined;
        if (model.navigationModel.activeNav == "Public" && model.currentRelay) {
            publicNode = (
                <PublicMessageContainer
                    ctx={myAccountCtx}
                    {...model.public}
                    getters={{
                        messageGetter: app.dmController,
                        convoListRetriever: app.conversationLists,
                        newMessageChecker: app.conversationLists,
                        relayRecordGetter: app.database,
                        getProfileByPublicKey: app.database.getProfileByPublicKey,
                        getProfilesByText: app.database.getProfilesByText,
                        isUserBlocked: app.conversationLists.isUserBlocked,
                        getEventByID: app.database.getEventByID,
                        isAdmin: this.state.isAdmin,
                        getReactionsByEventID: app.database.getReactionEvents,
                    }}
                    messages={Array.from(
                        map(
                            filter(
                                app.database.getAllEvents(),
                                (e) => {
                                    if (e.kind != NostrKind.TEXT_NOTE && e.kind != NostrKind.Long_Form) {
                                        return false;
                                    }
                                    const relays = app.database.getRelayRecord(e.id);
                                    return relays.has(model.currentRelay) &&
                                        !app.database.isDeleted(e.id, this.state.admin);
                                },
                            ),
                            (e) => {
                                const msg: ChatMessage = {
                                    author: e.publicKey,
                                    content: e.content,
                                    created_at: new Date(e.created_at * 1000),
                                    event: e as Parsed_Event<NostrKind.TEXT_NOTE | NostrKind.Long_Form>,
                                    lamport: getTags(e).lamport_timestamp,
                                    type: "text",
                                };
                                return msg;
                            },
                        ),
                    )}
                    relay_url={model.currentRelay}
                    bus={app.eventBus}
                />
            );
        }

        let profileEditorNode: VNode | undefined;
        if (model.navigationModel.activeNav == "Profile") {
            profileEditorNode = (
                <div
                    class={`h-full px-4 bg-[${SecondaryBackgroundColor}] flex-1 overflow-auto block`}
                >
                    <div
                        class={`max-w-[35rem] h-full m-auto`}
                    >
                        <EditProfile
                            ctx={model.app.ctx}
                            profile={app.database.getProfileByPublicKey(
                                myAccountCtx.publicKey,
                                model.currentRelay,
                            )?.profile ||
                                {}}
                            emit={props.eventBus.emit}
                        />
                    </div>
                </div>
            );
        }

        const final = (
            <div class={`h-screen w-full flex`}>
                <NavBar
                    publicKey={app.ctx.publicKey}
                    profile={app.database.getProfileByPublicKey(app.ctx.publicKey, model.currentRelay)}
                    emit={app.eventBus.emit}
                    installPrompt={props.installPrompt}
                    currentRelay={model.currentRelay}
                    activeNav={model.navigationModel.activeNav}
                    pool={app.pool}
                />
                {profileEditorNode}
                {publicNode}
                {dmVNode}
                {aboutNode}
                {Setting({
                    show: model.navigationModel.activeNav == "Setting",
                    logout: app.logout,
                    relayConfig: app.relayConfig,
                    myAccountContext: myAccountCtx,
                    relayPool: app.pool,
                    emit: props.eventBus.emit,
                })}
                <Popover
                    inputChan={props.popOverInputChan}
                />
                <RightPanel
                    inputChan={props.rightPanelInputChan}
                />
                <Toast inputChan={props.toastInputChan} />
                <Modal inputChan={props.modalInputChan} />
            </div>
        );

        console.debug("AppComponent:end", Date.now() - t);
        return final;
    }

    updateAdminState = async () => {
        const currentRelayInformation = await getRelayInformation(this.props.model.currentRelay);
        if (currentRelayInformation instanceof Error) {
            console.error(currentRelayInformation);
            return;
        }
        this.setState({
            admin: currentRelayInformation.pubkey,
            isAdmin: this.isAdmin(currentRelayInformation.pubkey),
        });
    };

    isAdmin = (admin?: string) => (pubkey: string) => {
        return admin === pubkey;
    };
}

async function sync_dm_events(
    ctx: NostrAccountContext,
    args: {
        database: Database_View;
        pool: ConnectionPool;
        since?: number;
    },
) {
    const messageStream = getAllEncryptedMessagesOf(
        ctx.publicKey,
        args.pool,
        args.since,
    );
    for await (const msg of messageStream) {
        if (msg.res.type == "EVENT") {
            const err = await args.database.addEvent(msg.res.event, msg.url);
            if (err instanceof Error) {
                console.log(err);
            }
        }
    }
}

async function sync_profile_events(
    args: {
        database: Database_View;
        pool: ConnectionPool;
        since: number | undefined;
    },
) {
    const { database, pool, since } = args;
    const messageStream = await pool.newSub("sync_profile_events", {
        kinds: [NostrKind.META_DATA],
        since,
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

const sync_public_notes = async (
    args: {
        pool: ConnectionPool;
        database: Database_View;
        since: number | undefined;
    },
) => {
    const { pool, database, since } = args;
    const stream = await pool.newSub("sync_public_notes", {
        kinds: [NostrKind.TEXT_NOTE, NostrKind.Long_Form],
        since,
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
        limit: 1,
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

const sync_deletion_events = async (
    args: {
        pool: ConnectionPool;
        database: Database_View;
        since: number | undefined;
    },
) => {
    const { pool, database, since } = args;
    const stream = await pool.newSub("sync_deletion_events", {
        kinds: [NostrKind.DELETE],
        since,
    });
    if (stream instanceof Error) {
        return stream;
    }
    for await (const msg of stream.chan) {
        if (msg.res.type === "EOSE") {
            continue;
        } else if (msg.res.type === "NOTICE") {
            console.log(`Notice: ${msg.res.note}`);
            continue;
        }

        const ok = await database.addEvent(msg.res.event, msg.url);
        if (ok instanceof Error) {
            console.error(msg);
            console.error(ok);
        }
    }
};

const sync_reaction_events = async (
    args: {
        pool: ConnectionPool;
        database: Database_View;
        since: number | undefined;
    },
) => {
    const { pool, database, since } = args;
    const stream = await pool.newSub("sync_reaction_events", {
        kinds: [NostrKind.REACTION],
        since,
    });
    if (stream instanceof Error) {
        return stream;
    }
    for await (const msg of stream.chan) {
        if (msg.res.type === "EOSE") {
            continue;
        } else if (msg.res.type === "NOTICE") {
            console.log(`Notice: ${msg.res.note}`);
            continue;
        }

        const ok = await database.addEvent(msg.res.event, msg.url);
        if (ok instanceof Error) {
            console.error(msg);
            console.error(ok);
        }
    }
};

export function hours_ago(time: number, hours: number) {
    return time - hours * 60 * 60;
}

const sync_space_members = async (
    pool: ConnectionPool,
    database: Database_View,
) => {
    for (const relay of pool.getRelays()) {
        forever((async () => {
            const chan = relay.getSpaceMembersStream();
            for await (const spaceMembers of chan) {
                if (spaceMembers instanceof Error) {
                    console.error(spaceMembers);
                } else {
                    for (const spaceMember of spaceMembers) {
                        await database.addEvent_v2(spaceMember, new URL(relay.url));
                    }
                }
            }
        })());
    }
};
