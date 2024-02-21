/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayAvatar } from "./components/avatar.tsx";
import { SelectRelay, setState } from "./nav.tsx";
import { RelayInformation } from "./relay-detail.tsx";

type RelaySwitchListProps = {
    pool: ConnectionPool;
    emit: emitFunc<SelectRelay>;
};

type RelaySwitchListState = {
    selectedRelay: string;
    relayInformation: Map<string, RelayInformation>;
};

export class RelaySwitchList extends Component<RelaySwitchListProps, RelaySwitchListState> {
    state: Readonly<RelaySwitchListState> = {
        selectedRelay: "",
        relayInformation: new Map(),
    };

    async componentDidMount() {
        for (const relay of this.props.pool.getRelays()) {
            getRelayInformation(relay.url).then((info) => {
                if (info instanceof Error) {
                    console.error(info);
                    return;
                }
                setState(this, {
                    relayInformation: this.state.relayInformation.set(relay.url, info),
                });
            });
        }
    }

    render() {
        const relayList = [];
        for (const relay of this.props.pool.getRelays()) {
            const domain = new URL(relay.url).hostname.split(".");
            relayList.push(
                <div
                    class="flex flex-row mx-1 my-1 hover:bg-[rgb(244,244,244)] hover:cursor-pointer"
                    onClick={this.onRelaySelected(relay)}
                >
                    <div class="w-16 h-16 border rounded-md mx-1">
                        <RelayAvatar
                            icon={this.state.relayInformation.get(relay.url)?.icon}
                            name={domain[domain.length - 2]}
                        />
                    </div>
                    <div>
                        <div>{this.state.relayInformation.get(relay.url)?.name}</div>
                        <div>{relay.url}</div>
                    </div>
                </div>,
            );
        }
        return (
            <div>
                <div class="w-16 h-16 border rounded-md mx-1 my-1">
                    <RelayAvatar
                        icon={this.state.relayInformation.get(this.state.selectedRelay)?.icon}
                        name={this.state.relayInformation.get(this.state.selectedRelay)?.name || "relay"}
                    />
                </div>
                <div class="flex flex-col border w-64 rounded-lg">{relayList}</div>
            </div>
        );
    }

    onRelaySelected = (relay: SingleRelayConnection) => async () => {
        await setState(this, {
            selectedRelay: relay.url,
        });
        this.props.emit({
            type: "SelectRelay",
            relay,
        });
    };
}

export async function getRelayInformation(url: string) {
    try {
        const httpURL = new URL(url);
        httpURL.protocol = "https";
        const res = await fetch(httpURL, {
            headers: {
                "Accept": "application/nostr+json",
            },
        });

        if (!res.ok) {
            return new Error(`Faild to get detail, ${res.status}: ${await res.text()}`);
        }

        const detail: RelayInformation = await res.json();
        return detail;
    } catch (e) {
        return e as Error;
    }
}
