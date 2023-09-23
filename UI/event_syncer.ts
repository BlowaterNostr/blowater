import { ConnectionPool, SubscriptionAlreadyExist } from "../lib/nostr-ts/relay.ts";
import { Database_Contextual_View } from "../database.ts";
import { NostrFilters, NostrKind, RelayResponse_REQ_Message, verifyEvent } from "../lib/nostr-ts/nostr.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { NoteID } from "../lib/nostr-ts/nip19.ts";

export class EventSyncer {
    constructor(private readonly pool: ConnectionPool, private readonly db: Database_Contextual_View) {}

    syncEvent(id: NoteID) {
        for (const e of this.db.events) {
            if (e.id == id.hex) {
                if(e.kind == NostrKind.DIRECT_MESSAGE) {
                    this.db.getDirectMessages(e.id)
                } else {
                    return e;
                }
            }
        }
        return (async () => {
            let events: Error | {
                filter: NostrFilters;
                chan: Channel<{
                    res: RelayResponse_REQ_Message;
                    url: string;
                }>;
            } = await this.pool.newSub("EventSyncer", {
                ids: [id.hex],
            });
            if (events instanceof SubscriptionAlreadyExist) {
                events = await this.pool.updateSub("EventSyncer", {
                    ids: [id.hex],
                });
            }
            if (events instanceof Error) {
                return events;
            }
            for await (const { res, url } of events.chan) {
                if (res.type != "EVENT") {
                    continue;
                }
                const ok = await verifyEvent(res.event);
                if (!ok) {
                    console.warn(res.event, url, "not valid");
                    continue;
                }
                await this.db.addEvent(res.event);
                return; // just need to read from 1 relay
            }
        })();
    }

    async syncEvents(filter: NostrFilters) {
        let events: Error | {
            filter: NostrFilters;
            chan: Channel<{
                res: RelayResponse_REQ_Message;
                url: string;
            }>;
        } = await this.pool.newSub("syncEvents", filter);
        if (events instanceof SubscriptionAlreadyExist) {
            events = await this.pool.updateSub("syncEvents", filter);
        }
        if (events instanceof Error) {
            return events;
        }
        for await (const { res, url } of events.chan) {
            if (res.type != "EVENT") {
                continue;
            }
            const ok = await verifyEvent(res.event);
            if (!ok) {
                console.warn(res.event, url, "not valid");
                continue;
            }
            await this.db.addEvent(res.event);
        }
    }
}
