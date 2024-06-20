/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { emitFunc } from "../event-bus.ts";
import { RelayAvatar } from "./components/avatar.tsx";
import { SelectSpace } from "./nav.tsx";
import { NavigationUpdate } from "./nav.tsx";
import { setState } from "./_helper.ts";
import { AddIcon } from "./icons/add-icon.tsx";
import { getRelayInformation, RelayInformation, robohash } from "../../libs/nostr.ts/nip11.ts";

type SpaceDropDownPanelProps = {
    spaceList: Set<string>;
    emit: emitFunc<SelectSpace | NavigationUpdate>;
    currentRelay: string;
};

type RelaySwitchListState = {
    showDropDown: boolean;
    relayInformation: Map<string, RelayInformation>;
    searchRelayValue: string;
};

export class SpaceDropDownPanel extends Component<SpaceDropDownPanelProps, RelaySwitchListState> {
    state: Readonly<RelaySwitchListState> = {
        relayInformation: new Map(),
        showDropDown: false,
        searchRelayValue: "",
    };

    async componentDidMount() {
        for (const url of this.props.spaceList) {
            getRelayInformation(url).then((info) => {
                if (info instanceof Error) {
                    console.error(info);
                    return;
                }
                setState(this, {
                    relayInformation: this.state.relayInformation.set(url, info),
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
        for (const url of this.props.spaceList) {
            if (!url.includes(this.state.searchRelayValue)) {
                continue;
            }
            relayList.push(
                this.SpaceListItem(url, this.props.currentRelay == url),
            );
        }
        return (
            <div class="">
                {this.TopIconButton()}
                {this.state.showDropDown ? this.DropDown(relayList) : undefined}
            </div>
        );
    }

    TopIconButton = () => {
        return (
            <div
                class="bg-white w-10 h-10 border rounded-lg hover:hover:cursor-pointer mb-1"
                onClick={this.toggleRelayList}
            >
                {this.props.currentRelay
                    ? (
                        <RelayAvatar
                            icon={this.state.relayInformation.get(this.props.currentRelay)?.icon ||
                                robohash(this.props.currentRelay)}
                        />
                    )
                    : <RelayAvatar icon="logo.webp" />}
            </div>
        );
    };

    DropDown = (spaceList: h.JSX.Element[]) => {
        return (
            <div class="absolute z-10 min-w-64 rounded-lg bg-neutral-700 p-3">
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
                    class="flex flex-col overflow-y-auto overflow-x-hidden"
                    style={{ maxHeight: "70vh" }}
                >
                    {spaceList}
                </div>
                {this.NewSpaceButton()}
            </div>
        );
    };

    SpaceListItem(spaceURL: string, isCurrentRelay: boolean) {
        const selected = isCurrentRelay ? " border-[#000] border" : "";
        return (
            <div
                class={"flex flex-row mx-1 my-1 hover:bg-neutral-500" +
                    " hover:cursor-pointer items-center rounded"}
                onClick={this.onSpaceSelected(spaceURL)}
            >
                <div class={`flex justify-center items-center w-12 h-12 rounded-md ${selected}`}>
                    <div class={`w-10 h-10 bg-neutral-600 rounded-md `}>
                        <RelayAvatar
                            icon={this.state.relayInformation.get(spaceURL)?.icon ||
                                robohash(spaceURL)}
                        />
                    </div>
                </div>
                <div class="px-1">
                    <div>{this.state.relayInformation.get(spaceURL)?.name}</div>
                    <div class="text-sm font-light">{new URL(spaceURL).hostname}</div>
                </div>
            </div>
        );
    }

    NewSpaceButton = () => {
        return (
            <div
                class={"flex flex-row mx-1 my-1 py-1" +
                    " bg-neutral-600" +
                    " hover:bg-neutral-500" +
                    " hover:cursor-pointer items-center rounded-lg justify-center" +
                    " text-white font-semibold"}
                onClick={this.onAddRelay}
            >
                New Space
            </div>
        );
    };

    toggleRelayList = async () => {
        await setState(this, {
            showDropDown: !this.state.showDropDown,
        });
    };

    onSpaceSelected = (spaceURL: string) => async () => {
        await setState(this, {
            showDropDown: false,
        });
        this.props.emit({
            type: "SelectSpace",
            spaceURL,
        });
    };

    onAddRelay = async () => {
        await setState(this, {
            showDropDown: false,
        });
        this.props.emit({
            type: "ChangeNavigation",
            id: "Setting",
        });
    };
}
