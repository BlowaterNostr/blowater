import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    DecryptionFailure,
    decryptNostrEvent,
    NostrAccountContext,
    NostrEvent,
    NostrKind,
    RelayResponse_REQ_Message,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import {
    Decryptable_Nostr_Event,
    Decrypted_Nostr_Event,
    getTags,
    ParsedTag_Nostr_Event,
    PlainText_Nostr_Event,
    Tag,
} from "./nostr.ts";
import * as csp from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { DexieDatabase } from "./UI/dexie-db.ts";

export const NotFound = Symbol("Not Found");
const buffer_size = 1000;
export interface Indices {
    readonly id?: string;
    readonly create_at?: number;
    readonly kind?: NostrKind;
    readonly tags?: Tag[];
    readonly pubkey?: string;
}

export class Database_Contextual_View {
    private readonly sourceOfChange = csp.chan<Decrypted_Nostr_Event | PlainText_Nostr_Event>(buffer_size);
    private readonly caster = csp.multi<Decrypted_Nostr_Event | PlainText_Nostr_Event>(this.sourceOfChange);

    static async New(database: DexieDatabase, ctx: NostrAccountContext) {
        const t = Date.now();
        const onload: (NostrEvent)[] = await database.events.filter(
            (e: NostrEvent) => {
                return e.kind != NostrKind.CustomAppData;
            },
        ).toArray();
        const cache: (PlainText_Nostr_Event | Decrypted_Nostr_Event)[] = onload.map((event) => {
            const e: PlainText_Nostr_Event = {
                content: event.content,
                created_at: event.created_at,
                id: event.id,
                // @ts-ignore
                kind: event.kind,
                pubkey: event.pubkey,
                sig: event.sig,
                tags: event.tags,
                parsedTags: getTags(event),
            };
            return e;
        });
        const db = new Database_Contextual_View(
            database,
            cache,
            ctx,
        );

        (async () => {
            let tt = 0;
            const events: Decryptable_Nostr_Event[] = await database.events.filter((e: NostrEvent) => {
                return e.kind == NostrKind.CustomAppData;
            }).toArray();
            for (const event of events) {
                if (event.kind == NostrKind.CustomAppData) {
                    const t2 = Date.now();
                    const e = await transformEvent({
                        content: event.content,
                        created_at: event.created_at,
                        id: event.id,
                        kind: event.kind,
                        pubkey: event.pubkey,
                        sig: event.sig,
                        tags: event.tags,
                    }, ctx);
                    tt += Date.now() - t2;
                    if (e == undefined) {
                        continue;
                    }
                    if (e instanceof Error) {
                        console.log("Database:delete", event.id);
                        database.events.delete(event.id);
                        continue;
                    }
                    cache.push(e);
                    await db.sourceOfChange.put(e);
                } else {
                    const e: PlainText_Nostr_Event = {
                        content: event.content,
                        created_at: event.created_at,
                        id: event.id,
                        kind: event.kind,
                        pubkey: event.pubkey,
                        sig: event.sig,
                        tags: event.tags,
                        parsedTags: getTags(event),
                    };
                    cache.push(e);
                    await db.sourceOfChange.put(e);
                }
            }
            console.log("Database_Contextual_View:transformEvent", tt);
        })();

        console.log("Database_Contextual_View:New", Date.now() - t);
        return db;
    }

    constructor(
        private readonly database: DexieDatabase,
        public readonly events: (PlainText_Nostr_Event | Decrypted_Nostr_Event)[],
        private readonly ctx: NostrAccountContext,
    ) {}

    public readonly getEvent = async (keys: Indices): Promise<NostrEvent | undefined> => {
        return this.database.events.get(keys);
    };

    public readonly filterEvents = (filter: (e: NostrEvent) => boolean) => {
        return this.events.filter(filter);
    };

    async addEvent(event: NostrEvent) {
        const storedEvent = await this.getEvent({ id: event.id });
        if (storedEvent) { // event exist
            return;
        }
        console.log("Database.addEvent", event.id);
        await this.database.events.put(event);
        if (event.kind == NostrKind.CustomAppData) {
            const e = await transformEvent({
                content: event.content,
                created_at: event.created_at,
                id: event.id,
                kind: event.kind,
                pubkey: event.pubkey,
                sig: event.sig,
                tags: event.tags,
            }, this.ctx);
            if (e == undefined) {
                return;
            }
            if (e instanceof Error) {
                console.log("Database:delete", event.id);
                this.database.events.delete(event.id);
                return;
            }
            this.events.push(e);
            await this.sourceOfChange.put(e);
        } else {
            const e: PlainText_Nostr_Event = {
                content: event.content,
                created_at: event.created_at,
                id: event.id,
                kind: event.kind,
                pubkey: event.pubkey,
                sig: event.sig,
                tags: event.tags,
                parsedTags: getTags(event),
            };
            this.events.push(e);
            await this.sourceOfChange.put(e);
        }
    }

    syncEvents(
        filter: (e: NostrEvent) => boolean,
        events: csp.Channel<[NostrEvent, string /*relay url*/]>,
    ): csp.Channel<NostrEvent> {
        const resChan = csp.chan<NostrEvent>(buffer_size);
        (async () => {
            for await (const [e, url] of events) {
                if (resChan.closed()) {
                    await events.close(
                        "db syncEvents, resChan is closed, closing the source events",
                    );
                    return;
                }
                if (filter(e)) {
                    await this.addEvent(e);
                } else {
                    console.log(
                        "event",
                        e,
                        "does not satisfy filterer",
                        filter,
                    );
                }
            }
            await resChan.close(
                "db syncEvents, source events is closed, closing the resChan",
            );
        })();
        return resChan;
    }

    async syncNewDirectMessageEventsOf(
        accountContext: NostrAccountContext,
        msgs: csp.Channel<{ res: RelayResponse_REQ_Message; url: string }>,
    ): Promise<csp.Channel<NostrEvent | DecryptionFailure>> {
        const resChan = csp.chan<NostrEvent | DecryptionFailure>(buffer_size);
        const publicKey = accountContext.publicKey;
        (async () => {
            for await (const { res: msg, url } of msgs) {
                if (msg.type !== "EVENT") {
                    continue;
                }
                const encryptedEvent = msg.event;
                const theirPubKey = whoIamTalkingTo(encryptedEvent, publicKey);
                if (theirPubKey instanceof Error) {
                    // this could happen if the user send an event without p tag
                    // because the application is subscribing all events send by the user
                    console.warn(theirPubKey);
                    continue;
                }

                const decryptedEvent = await decryptNostrEvent(
                    encryptedEvent,
                    accountContext,
                    theirPubKey,
                );
                if (decryptedEvent instanceof DecryptionFailure) {
                    resChan.put(decryptedEvent).then(async (res) => {
                        if (res instanceof csp.PutToClosedChannelError) {
                            await msgs.close(
                                "resChan has been closed, closing the source chan",
                            );
                        }
                    });
                    continue;
                }
                const storedEvent = await this.getEvent({
                    id: encryptedEvent.id,
                });
                if (storedEvent === undefined) {
                    try {
                        await this.addEvent(decryptedEvent);
                    } catch (e) {
                        console.log(e.message);
                    }
                    resChan.put(decryptedEvent).then(async (res) => {
                        if (res instanceof csp.PutToClosedChannelError) {
                            await msgs.close(
                                "resChan has been closed, closing the source chan",
                            );
                        }
                    });
                }
                // else do nothing
            }
            await resChan.close("source chan is clsoed, closing the resChan");
        })();
        return resChan;
    }

    //////////////////
    // On DB Change //
    //////////////////
    onChange(filter: (e: NostrEvent) => boolean) {
        const c = this.caster.copy();
        const res = csp.chan<NostrEvent>(buffer_size);
        (async () => {
            for await (const newE of c) {
                if (filter(newE)) {
                    const err = await res.put(newE);
                    if (err instanceof csp.PutToClosedChannelError) {
                        await c.close(
                            "onChange listern has been closed, closing the source",
                        );
                    }
                }
            }
            await res.close(
                "onChange source has been closed, closing the listener",
            );
        })();
        return res;
    }
}

export function whoIamTalkingTo(event: NostrEvent, myPublicKey: PublicKey) {
    if (event.kind !== NostrKind.DIRECT_MESSAGE) {
        console.log(event);
        return new Error(`event ${event.id} is not a DM`);
    }
    // first asuming the other user is the sender
    let whoIAmTalkingTo = event.pubkey;
    const tags = getTags(event).p;
    // if I am the sender
    if (event.pubkey === myPublicKey.hex) {
        if (tags.length === 1) {
            const theirPubKey = tags[0];
            whoIAmTalkingTo = theirPubKey;
            return whoIAmTalkingTo;
        } else if (tags.length === 0) {
            console.log(event);
            return Error(
                `No p tag is found - Not a valid DM - id ${event.id}, kind ${event.kind}`,
            );
        } else {
            return Error(`Multiple tag p: ${event}`);
        }
    } else {
        if (tags.length === 1) {
            const receiverPubkey = tags[0];
            if (receiverPubkey !== myPublicKey.hex) {
                return Error(
                    `Not my message, receiver is ${receiverPubkey}, sender is ${event.pubkey}, my key is ${myPublicKey}`,
                );
            }
        } else if (tags.length === 0) {
            return Error(
                `This is not a valid DM, id ${event.id}, kind ${event.kind}`,
            );
        } else {
            console.log(event);
            return Error(`Multiple tag p: ${event}`);
        }
    }
    // I am the receiver
    return whoIAmTalkingTo;
}

async function transformEvent(event: Decryptable_Nostr_Event, ctx: NostrAccountContext) {
    if (event.pubkey == ctx.publicKey.hex) {
        // if I am the author
        const decrypted = await ctx.decrypt(ctx.publicKey.hex, event.content);
        if (decrypted instanceof Error) {
            return decrypted;
        }
        const e: Decrypted_Nostr_Event = {
            content: event.content,
            created_at: event.created_at,
            id: event.id,
            kind: event.kind,
            pubkey: event.pubkey,
            sig: event.sig,
            tags: event.tags,
            parsedTags: getTags(event),
            decryptedContent: decrypted,
        };
        return e;
    }
}
