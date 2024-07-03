/** @jsx h */
import { Component, h } from "preact";
import { emitFunc } from "../event-bus.ts";
import { RelayAvatar } from "./components/avatar.tsx";
import { SelectSpace } from "./nav.tsx";
import { NavigationUpdate } from "./nav.tsx";
import { setState } from "./_helper.ts";
import { getRelayInformation, RelayInformation, robohash } from "@blowater/nostr-sdk";
import { ViewSpaceSettings } from "./setting.tsx";

type SpaceDropDownPanelProps = {
    spaceList: Set<string>;
    emit: emitFunc<SelectSpace | NavigationUpdate | ViewSpaceSettings>;
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
            <div class="absolute z-10 min-w-64 rounded-lg bg-neutral-700 text-white p-4">
                {this.SettingsButton()}
                {/* {this.InviteButton()} */}
                <div class="border border-neutral-600 my-3"></div>
                <div class="w-full flex mb-3">
                    <input
                        type="text"
                        class="flex-grow rounded-lg px-2 py-1 text-white bg-neutral-600 focus:outline-none focus:border-white"
                        placeholder="filter spaces"
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
                class={"flex flex-row mb-2 hover:bg-neutral-500" +
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
                <div class="px-2">
                    <div>{this.state.relayInformation.get(spaceURL)?.name}</div>
                    <div class="text-sm font-light">{new URL(spaceURL).hostname}</div>
                </div>
            </div>
        );
    }

    SettingsButton = () => (
        <div
            class={"flex flex-row items-center p-2 rounded-lg" +
                " hover:bg-neutral-500 hover:cursor-pointer"}
            onClick={() => {
                this.props.emit({
                    type: "ViewSpaceSettings",
                    url: this.props.currentRelay,
                });
            }}
        >
            <svg
                class="w-6 h-6 mr-2"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M7.00003 4.00003C6.40668 4.00003 5.82667 4.17598 5.33332 4.50562C4.83997 4.83526 4.45545 5.3038 4.22839 5.85198C4.00133 6.40016 3.94192 7.00336 4.05767 7.5853C4.17343 8.16724 4.45915 8.70179 4.87871 9.12135C5.29827 9.54091 5.83281 9.82663 6.41476 9.94238C6.9967 10.0581 7.5999 9.99873 8.14808 9.77167C8.69626 9.5446 9.16479 9.16009 9.49444 8.66674C9.82408 8.17339 10 7.59337 10 7.00003C9.9992 6.20463 9.68287 5.44205 9.12044 4.87962C8.55801 4.31719 7.79542 4.00086 7.00003 4.00003ZM7.00003 9.00003C6.60447 9.00003 6.21779 8.88273 5.88889 8.66297C5.55999 8.4432 5.30364 8.13085 5.15227 7.7654C5.00089 7.39994 4.96129 6.99781 5.03846 6.60985C5.11563 6.22189 5.30611 5.86552 5.58581 5.58581C5.86552 5.30611 6.22189 5.11563 6.60985 5.03846C6.99781 4.96129 7.39994 5.00089 7.7654 5.15227C8.13085 5.30364 8.4432 5.55999 8.66297 5.88889C8.88273 6.21779 9.00003 6.60447 9.00003 7.00003C9.00003 7.53046 8.78931 8.03917 8.41424 8.41424C8.03917 8.78931 7.53046 9.00003 7.00003 9.00003ZM12.5 7.13503C12.5025 7.04503 12.5025 6.95503 12.5 6.86503L13.4325 5.70003C13.4814 5.63886 13.5153 5.56706 13.5313 5.49042C13.5474 5.41378 13.5452 5.33443 13.525 5.25878C13.3722 4.68415 13.1435 4.13243 12.845 3.61815C12.806 3.55085 12.7517 3.4936 12.6866 3.45096C12.6215 3.40832 12.5473 3.38146 12.47 3.37253L10.9875 3.20753C10.9259 3.14253 10.8634 3.08003 10.8 3.02003L10.625 1.53378C10.616 1.45641 10.5891 1.38222 10.5463 1.31711C10.5036 1.252 10.4462 1.19779 10.3788 1.15878C9.8643 0.86087 9.31263 0.632425 8.73815 0.479404C8.66245 0.459277 8.58308 0.457218 8.50643 0.473394C8.42979 0.489569 8.35802 0.523527 8.2969 0.572529L7.13503 1.50003C7.04503 1.50003 6.95503 1.50003 6.86503 1.50003L5.70003 0.569404C5.63886 0.520509 5.56706 0.486665 5.49042 0.470598C5.41378 0.454531 5.33443 0.456691 5.25878 0.476903C4.68425 0.630045 4.13256 0.858705 3.61815 1.1569C3.55085 1.19598 3.4936 1.25023 3.45096 1.31533C3.40832 1.38044 3.38146 1.45459 3.37253 1.5319L3.20753 3.0169C3.14253 3.07899 3.08003 3.14149 3.02003 3.2044L1.53378 3.37503C1.45641 3.38403 1.38222 3.41098 1.31711 3.45373C1.252 3.49649 1.19779 3.55386 1.15878 3.62128C0.86087 4.13576 0.632425 4.68743 0.479404 5.2619C0.459277 5.33761 0.457218 5.41698 0.473394 5.49362C0.489569 5.57027 0.523527 5.64204 0.572529 5.70315L1.50003 6.86503C1.50003 6.95503 1.50003 7.04503 1.50003 7.13503L0.569404 8.30003C0.520509 8.3612 0.486665 8.43299 0.470598 8.50964C0.454531 8.58628 0.456691 8.66562 0.476903 8.74128C0.629772 9.3159 0.858447 9.86762 1.1569 10.3819C1.19598 10.4492 1.25023 10.5065 1.31533 10.5491C1.38044 10.5917 1.45459 10.6186 1.5319 10.6275L3.0144 10.7925C3.07649 10.8575 3.13899 10.92 3.2019 10.98L3.37503 12.4663C3.38403 12.5436 3.41098 12.6178 3.45373 12.6829C3.49649 12.7481 3.55386 12.8023 3.62128 12.8413C4.13576 13.1392 4.68743 13.3676 5.2619 13.5207C5.33761 13.5408 5.41698 13.5428 5.49362 13.5267C5.57027 13.5105 5.64204 13.4765 5.70315 13.4275L6.86503 12.5C6.95503 12.5025 7.04503 12.5025 7.13503 12.5L8.30003 13.4325C8.3612 13.4814 8.43299 13.5153 8.50964 13.5313C8.58628 13.5474 8.66562 13.5452 8.74128 13.525C9.3159 13.3722 9.86762 13.1435 10.3819 12.845C10.4492 12.806 10.5065 12.7517 10.5491 12.6866C10.5917 12.6215 10.6186 12.5473 10.6275 12.47L10.7925 10.9875C10.8575 10.9259 10.92 10.8634 10.98 10.8L12.4663 10.625C12.5436 10.616 12.6178 10.5891 12.6829 10.5463C12.7481 10.5036 12.8023 10.4462 12.8413 10.3788C13.1392 9.8643 13.3676 9.31263 13.5207 8.73815C13.5408 8.66245 13.5428 8.58308 13.5267 8.50643C13.5105 8.42979 13.4765 8.35802 13.4275 8.2969L12.5 7.13503ZM11.4938 6.72878C11.5044 6.90946 11.5044 7.0906 11.4938 7.27128C11.4863 7.39498 11.5251 7.51703 11.6025 7.61378L12.4894 8.7219C12.3876 9.04532 12.2573 9.35905 12.1 9.6594L10.6875 9.8194C10.5645 9.83306 10.4509 9.89185 10.3688 9.9844C10.2485 10.1197 10.1203 10.2478 9.98503 10.3682C9.89247 10.4503 9.83368 10.5639 9.82003 10.6869L9.66315 12.0982C9.36284 12.2555 9.0491 12.3858 8.72565 12.4875L7.6169 11.6007C7.52818 11.5298 7.41797 11.4912 7.3044 11.4913H7.2744C7.09373 11.5019 6.91258 11.5019 6.7319 11.4913C6.60821 11.4838 6.48615 11.5226 6.3894 11.6L5.27815 12.4875C4.95474 12.3858 4.641 12.2555 4.34065 12.0982L4.18065 10.6875C4.167 10.5645 4.10821 10.4509 4.01565 10.3688C3.88035 10.2485 3.75221 10.1203 3.6319 9.98503C3.54974 9.89247 3.43616 9.83368 3.31315 9.82003L1.9019 9.66253C1.74452 9.36222 1.61422 9.04847 1.51253 8.72503L2.3994 7.61628C2.47684 7.51953 2.5156 7.39748 2.50815 7.27378C2.49753 7.0931 2.49753 6.91196 2.50815 6.73128C2.5156 6.60758 2.47684 6.48552 2.3994 6.38878L1.51253 5.27815C1.61429 4.95474 1.7446 4.641 1.9019 4.34065L3.31253 4.18065C3.43554 4.167 3.54911 4.10821 3.63128 4.01565C3.75159 3.88035 3.87972 3.75221 4.01503 3.6319C4.10795 3.54968 4.16698 3.43585 4.18065 3.31253L4.33753 1.9019C4.63784 1.74452 4.95158 1.61422 5.27503 1.51253L6.38378 2.3994C6.48052 2.47684 6.60258 2.5156 6.72628 2.50815C6.90696 2.49753 7.0881 2.49753 7.26878 2.50815C7.39248 2.5156 7.51453 2.47684 7.61128 2.3994L8.7219 1.51253C9.04532 1.61429 9.35905 1.7446 9.6594 1.9019L9.8194 3.31253C9.83306 3.43554 9.89185 3.54911 9.9844 3.63128C10.1197 3.75159 10.2478 3.87972 10.3682 4.01503C10.4503 4.10758 10.5639 4.16637 10.6869 4.18003L12.0982 4.3369C12.2555 4.63722 12.3858 4.95096 12.4875 5.2744L11.6007 6.38315C11.5225 6.48071 11.4837 6.60403 11.4919 6.72878H11.4938Z"
                    fill="#D4D4D4"
                />
            </svg>

            <p>Settings</p>
        </div>
    );

    InviteButton = () => (
        <div
            class={"flex flex-row items-center p-2 rounded-lg" +
                " hover:bg-neutral-500 hover:cursor-pointer"}
        >
            <svg
                class="w-6 h-6 mr-2"
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <path
                    d="M14.2075 0.792544C14.0818 0.666877 13.9248 0.577003 13.7528 0.532182C13.5807 0.487361 13.3998 0.489212 13.2288 0.537544H13.2194L1.22313 4.17754C1.02838 4.23367 0.855281 4.34765 0.726772 4.50438C0.598262 4.66111 0.520411 4.85319 0.503534 5.05517C0.486658 5.25714 0.531553 5.45948 0.63227 5.63536C0.732988 5.81125 0.884772 5.95237 1.06751 6.04004L6.37501 8.62504L8.95626 13.9294C9.03654 14.1007 9.16419 14.2455 9.32411 14.3466C9.48403 14.4477 9.66955 14.501 9.85876 14.5C9.88751 14.5 9.91626 14.4988 9.94501 14.4963C10.1468 14.48 10.3388 14.4023 10.4952 14.2737C10.6516 14.1451 10.765 13.9718 10.82 13.7769L14.4575 1.78067C14.4575 1.77754 14.4575 1.77442 14.4575 1.77129C14.5065 1.60065 14.5091 1.42004 14.4652 1.24803C14.4212 1.07602 14.3323 0.918809 14.2075 0.792544ZM9.86438 13.4907L9.86126 13.4994V13.495L7.35751 8.35129L10.3575 5.35129C10.4473 5.25676 10.4966 5.13089 10.495 5.00051C10.4933 4.87013 10.4408 4.74556 10.3486 4.65335C10.2564 4.56115 10.1318 4.50862 10.0014 4.50695C9.87104 4.50528 9.74517 4.55461 9.65063 4.64442L6.65064 7.64442L1.50501 5.14067H1.50063H1.50938L13.5 1.50004L9.86438 13.4907Z"
                    fill="#D4D4D4"
                />
            </svg>

            <p>Invite</p>
        </div>
    );

    NewSpaceButton = () => {
        return (
            <div
                class={"flex flex-row my-1 py-1" +
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
