/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ConnectionPool } from "../../libs/nostr.ts/relay-pool.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayAvatar } from "./components/avatar.tsx";
import { SelectRelay } from "./nav.tsx";
import { RelayInformation } from "./relay-detail.tsx";
import { setState } from "./_helper.ts";
import { join } from "https://deno.land/std@0.202.0/path/mod.ts";

type RelaySwitchListProps = {
    currentRelay?: string;
    pool: ConnectionPool;
    emit: emitFunc<SelectRelay>;
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
                this.RelayListItem(relay, this.props.currentRelay),
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
                                icon={this.state.relayInformation.get(this.props.currentRelay)?.icon}
                                name={getSecondaryDomainName(this.props.currentRelay)}
                            />
                        )
                        : <RelayAvatar icon="logo.webp" name="" />}
                </div>
                {this.state.showRelayList
                    ? (
                        <div class="absolute z-10 border min-w-64 rounded-lg bg-white py-1">
                            <div class="w-full flex">
                                <input
                                    type="text"
                                    class="flex-grow border rounded-lg mx-2 my-1 px-2"
                                    placeholder="Search relay"
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
                        </div>
                    )
                    : undefined}
            </div>
        );
    }

    RelayListItem(relay: SingleRelayConnection, currentRelay?: string) {
        const selected = relay.url === currentRelay ? " border-[#000] border-2" : "";
        return (
            <div
                class={`flex flex-row mx-1 my-1 hover:bg-[rgb(244,244,244)] hover:cursor-pointer items-center rounded`}
                onClick={this.onRelaySelected(relay)}
            >
                <div class={`flex justify-center items-center w-12 h-12 rounded-md ${selected}`}>
                    <div class={`w-10 h-10 border rounded-md `}>
                        <RelayAvatar
                            icon={this.state.relayInformation.get(relay.url)?.icon}
                            name={getSecondaryDomainName(relay.url)}
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
        this.props.emit({
            type: "SelectRelay",
            relay,
        });
    };
}

function getSecondaryDomainName(url: string) {
    const domain = new URL(url).hostname.split(".");
    return domain[domain.length - 2];
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
        if (!detail.icon) {
            detail.icon = join(httpURL.toString(), "favicon.ico");
        }
        return detail;
    } catch (e) {
        return e as Error;
    }
}
