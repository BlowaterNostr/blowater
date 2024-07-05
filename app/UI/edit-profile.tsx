import { createRef, h } from "preact";
import { ProfileData } from "../features/profile.ts";
import { Component } from "preact";
import { emitFunc } from "../event-bus.ts";
import { NostrAccountContext } from "@blowater/nostr-sdk";
import { CloseIcon } from "./icons/close-icon.tsx";
import { HideModal } from "./components/modal.tsx";
import { CameraPlusIcon } from "./icons/camera-plus-icon.tsx";
import { UploadImage } from "./editor.tsx";
import { setState } from "./_helper.ts";

export type SaveProfile = {
    type: "SaveProfile";
    profile: ProfileData | undefined;
    ctx: NostrAccountContext;
};

type Props = {
    ctx: NostrAccountContext;
    profile: ProfileData;
    emit: emitFunc<SaveProfile | HideModal | UploadImage>;
};

type State = {
    profileData: ProfileData | undefined;
    newFieldKeyError: string;
};

export class EditProfile extends Component<Props, State> {
    state: Readonly<State> = {
        newFieldKeyError: "",
        profileData: undefined,
    };

    newFieldKey = createRef<HTMLInputElement>();
    newFieldValue = createRef<HTMLInputElement>();

    componentDidMount(): void {
        this.setState({
            profileData: this.props.profile,
        });
    }

    render(_props: Props, state: State) {
        const uploadFileInput = createRef();
        return (
            <div class="h-auto max:h-[60dvh] w-[95dvw] sm:w-[80dvw] md:w-[40dvw] bg-neutral-700 rounded-xl text-white text-sm font-sans font-medium leading-5">
                <div class="w-full h-full flex flex-col p-[1rem]">
                    <div class="flex flex-row grow pb-2">
                        <div class="text-xl font-semibold leading-7 flex-1">Profile Settings</div>
                        <button
                            class="w-6 min-w-[1.5rem] h-6 focus:outline-none focus-visible:outline-none rounded-full hover:bg-neutral-500 z-10 flex items-center justify-center "
                            onClick={async () => {
                                await _props.emit({
                                    type: "HideModal",
                                });
                            }}
                        >
                            <CloseIcon
                                class={`w-4 h-4`}
                                style={{
                                    stroke: "rgb(185, 187, 190)",
                                }}
                            />
                        </button>
                    </div>
                    <div class="flex flex-row h-[90%]">
                        <form
                            class={`w-full h-full overflow-y-auto flex flex-col gap-2`}
                            onSubmit={this.onSubmit}
                        >
                            <div class="flex flex-col justify-start relative">
                                <img
                                    src={`${this.state.profileData?.picture || "/logo.webp"}`}
                                    class="w-16 h-16 rounded-full object-cover bg-white"
                                />
                                <input
                                    ref={uploadFileInput}
                                    type="file"
                                    accept="image/*"
                                    onChange={this.uploadImage}
                                    class="hidden bg-[#FFFFFF2C]"
                                />
                                <button
                                    type="button"
                                    class="absolute inset-0 flex items-center justify-center w-16 h-16 text-white group"
                                    onClick={() => {
                                        if (uploadFileInput.current) {
                                            uploadFileInput.current.click();
                                        }
                                    }}
                                >
                                    <div class="w-9 h-9 bg-black/20 group-hover:bg-black/50 rounded-full flex justify-center items-center">
                                        <CameraPlusIcon class="w-6 b-6" />
                                    </div>
                                </button>
                            </div>
                            <div class="text-neutral-300 text-sm font-medium leading-5 font-sans">
                                Name
                            </div>
                            <input
                                value={state.profileData?.name}
                                name="name"
                                onInput={(e) => this.onInput(e, "name")}
                                type="text"
                                class={`focus:outline-none w-full px-4 py-3 rounded-lg bg-neutral-600 text-white text-sm font-normal font-sans leading-5`}
                            />
                            <div class="text-neutral-300 text-sm font-medium leading-5 font-sans">
                                Bio
                            </div>
                            <input
                                value={state.profileData?.about}
                                name="about"
                                onInput={(e) => this.onInput(e, "about")}
                                type="text"
                                class={`focus:outline-none w-full px-4 py-3 rounded-lg bg-neutral-600 text-white text-sm font-normal font-sans leading-5`}
                            />
                            <h3 class="text-neutral-300 text-sm font-medium leading-5 font-sans">
                                Website
                            </h3>
                            <input
                                value={state.profileData?.website}
                                name="website"
                                onInput={(e) => this.onInput(e, "website")}
                                type="text"
                                class={`focus:outline-none w-full px-4 py-3 rounded-lg bg-neutral-600 text-white text-sm font-normal font-sans leading-5`}
                            />

                            <button
                                class={`flex items-center justify-center bg-blue-600 hover:bg-blue-700 w-full h-12 rounded-lg text-white text-sm font-semibold font-sans leading-5`}
                                type="submit"
                            >
                                Save
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    onInput = (e: h.JSX.TargetedEvent<HTMLTextAreaElement | HTMLInputElement, Event>, key?: string) => {
        const lines = e.currentTarget.value.split("\n");
        e.currentTarget.setAttribute(
            "rows",
            `${lines.length}`,
        );
        if (key) {
            const value = e.currentTarget.value;
            this.setState({
                profileData: {
                    ...this.state.profileData,
                    [key]: value,
                },
            });
        }
    };

    addField = () => {
        if (!this.newFieldKey.current || !this.newFieldValue.current) {
            return;
        }

        if (this.newFieldKey.current.value.trim() == "") {
            this.setState({
                newFieldKeyError: "Key is required.",
            });
            return;
        }

        console.log(`Adding field ${this.newFieldKey.current.value}`);
        console.log(`Adding field ${this.newFieldValue.current.value}`);

        this.setState({
            profileData: {
                ...this.state.profileData,
                [this.newFieldKey.current.value]: this.newFieldValue.current.value,
            },
            newFieldKeyError: "",
        });

        this.newFieldKey.current.value = "";
        this.newFieldValue.current.value = "";
    };

    uploadImage = (e: h.JSX.TargetedEvent<HTMLInputElement>) => {
        const { props, state } = this;
        const selectedFiles = e.currentTarget.files;
        if (!selectedFiles) {
            return;
        }
        props.emit({
            type: "UploadImage",
            file: selectedFiles[0],
            callback: (uploaded) => {
                console.log("uploaded", uploaded);
                if (uploaded instanceof Error) {
                    console.error(uploaded);
                    return;
                }
                if (uploaded.status === "error") {
                    console.error(uploaded.message);
                    return;
                }
                if (!uploaded.nip94_event) {
                    console.error("No NIP-94 event found", uploaded);
                    return;
                }
                const image_url = uploaded.nip94_event.tags[0][1];
                setState(this, {
                    profileData: { ...state.profileData, picture: image_url },
                });
            },
        });
    };

    onSubmit = (e: h.JSX.TargetedEvent) => {
        e.preventDefault();
        this.props.emit({
            type: "SaveProfile",
            ctx: this.props.ctx,
            profile: this.state.profileData,
        });
    };
}
