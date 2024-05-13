/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayAvatar } from "./components/avatar.tsx";
import { SelectRelay } from "./nav.tsx";
import { NavigationUpdate } from "./nav.tsx";
import { getRelayInformation, RelayInformation, robohash } from "./relay-detail.tsx";
import { setState } from "./_helper.ts";
import { AddIcon } from "./icons/add-icon.tsx";

type RelaySwitchListProps = {
    currentRelay: {
        url: string;
        relayInformation: RelayInformation;
    };
    pool: ConnectionPool;
    emit: emitFunc<SelectRelay | NavigationUpdate>;
};

type RelaySwitchListState = {
    showRelayList: boolean;
    relayInformation: Map<string, RelayInformation>;
    searchRelayValue: string;
};

export class RelaySwitchList extends Component<RelaySwitchListProps, RelaySwitchListState> {
    state: Readonly<RelaySwitchListState> = {
        relayInformation: new Map(),
        showRelayList: false,
        searchRelayValue: "",
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

    handleSearchRelayInput = async (e: Event) => {
        await setState(this, {
            searchRelayValue: (e.target as HTMLInputElement).value,
        });
    };

    render() {
        const relayList = [];
        for (const relay of this.props.pool.getRelays()) {
            if (!relay.url.includes(this.state.searchRelayValue)) {
                continue;
            }
            relayList.push(
                this.RelayListItem(relay, this.props.currentRelay.url == relay.url),
            );
        }
        return (
            <div class="">
                <div
                    class="bg-white w-10 h-10 border rounded-lg hover:hover:cursor-pointer mb-1"
                    onClick={this.toggleRelayList}
                >
                    {this.props.currentRelay
                        ? (
                            <RelayAvatar
                                icon={this.props.currentRelay.relayInformation.icon ||
                                    robohash(this.props.currentRelay.url)}
                            />
                        )
                        : <RelayAvatar icon="logo.webp" />}
                </div>
                {this.state.showRelayList
                    ? (
                        <div class="absolute z-10 border min-w-64 rounded-lg bg-white py-1">
                            <div class="w-full flex">
                                <input
                                    type="text"
                                    class="flex-grow border rounded-lg mx-2 my-1 px-2"
                                    placeholder="filter relays"
                                    value={this.state.searchRelayValue}
                                    onInput={this.handleSearchRelayInput}
                                />
                            </div>
                            <div
                                class="flex flex-col overflow-y-auto overflow-x-hidde"
                                style={{ maxHeight: "70vh" }}
                            >
                                {relayList}
                            </div>
                            <div
                                class={`flex flex-row mx-1 my-1 hover:bg-[rgb(244,244,244)] hover:cursor-pointer items-center rounded`}
                                onClick={this.onAddRelay}
                            >
                                <div
                                    class={`flex justify-center items-center w-12 h-12 rounded-md border-none`}
                                >
                                    <div
                                        class={`flex justify-center items-center w-10 h-10 border rounded-md bg-[#F2F2F2]`}
                                    >
                                        <AddIcon
                                            style={{
                                                width: "60%",
                                                height: "60%",
                                            }}
                                        />
                                    </div>
                                </div>
                                <div class="px-1 font-light">
                                    Add a relay
                                </div>
                            </div>
                        </div>
                    )
                    : undefined}
            </div>
        );
    }

    RelayListItem(relay: SingleRelayConnection, isCurrentRelay: boolean) {
        const selected = isCurrentRelay ? " border-[#000] border-2" : "";
        return (
            <div
                class={`flex flex-row mx-1 my-1 hover:bg-[rgb(244,244,244)] hover:cursor-pointer items-center rounded`}
                onClick={this.onRelaySelected(relay)}
            >
                <div class={`flex justify-center items-center w-12 h-12 rounded-md ${selected}`}>
                    <div class={`w-10 h-10 border rounded-md `}>
                        <RelayAvatar
                            icon={this.state.relayInformation.get(relay.url)?.icon ||
                                robohash(relay.url)}
                        />
                    </div>
                </div>
                <div class="px-1">
                    <div>{this.state.relayInformation.get(relay.url)?.name}</div>
                    <div class="text-sm font-light">{new URL(relay.url).hostname}</div>
                </div>
            </div>
        );
    }

    toggleRelayList = async () => {
        await setState(this, {
            showRelayList: !this.state.showRelayList,
        });
    };

    onRelaySelected = (relay: SingleRelayConnection) => async () => {
        await setState(this, {
            showRelayList: false,
        });
        const relayInformation = this.state.relayInformation.get(relay.url);
        if (!relayInformation) {
            console.error("relay information not found");
            return;
        }
        this.props.emit({
            type: "SelectRelay",
            relay,
            relayInformation,
        });
    };

    onAddRelay = async () => {
        await setState(this, {
            showRelayList: false,
        });
        this.props.emit({
            type: "ChangeNavigation",
            id: "Setting",
        });
    };
}

function getSecondaryDomainName(url: string) {
    const domain = new URL(url).hostname.split(".");
    return domain[domain.length - 2];
}
