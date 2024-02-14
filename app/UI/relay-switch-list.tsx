/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { RelayInformation, SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayAvatar } from "./components/avatar.tsx";
import { SelectRelay, setState } from "./nav.tsx";

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
            relay.getInformation().then((info) => {
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
            const rounded = this.state.selectedRelay == relay.url ? "rounded-lg" : "rounded-full";
            relayList.push(
                <button
                    class={`hover:rounded-lg ${rounded} my-2 bg-white ease-in-out transition duration-200`}
                    onClick={this.onRelaySelected(relay)}
                >
                    <RelayAvatar
                        icon={this.state.relayInformation.get(relay.url)?.icon}
                        name={new URL(relay.url).origin}
                    />
                </button>,
            );
        }
        return relayList;
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
