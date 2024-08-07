/** @jsx h */
import { createRef, h } from "preact";
import { emitFunc } from "../event-bus.ts";

import { ImageIcon } from "./icons/image-icon.tsx";
import { SendIcon } from "./icons/send-icon.tsx";
import { Component } from "preact";
import { RemoveIcon } from "./icons/remove-icon.tsx";
import { setState } from "./_helper.ts";
import { XCircleIcon } from "./icons/x-circle-icon.tsx";
import { func_GetProfileByPublicKey, func_GetProfilesByText } from "./search.tsx";
import { NoteID } from "@blowater/nostr-sdk";
import { EventSubscriber } from "../event-bus.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { Parsed_Event } from "../nostr.ts";
import { Profile_Nostr_Event } from "../nostr.ts";
import { Avatar } from "./components/avatar.tsx";
import { UploadFileResponse } from "@blowater/nostr-sdk";
import { robohash } from "@blowater/nostr-sdk";

export type EditorEvent = SendMessage | UploadImage | EditorSelectProfile;

export type SendMessage = {
    readonly type: "SendMessage";
    readonly text: string;
    readonly files: Blob[];
    readonly reply_to_event_id?: string | NoteID;
};

export type UploadImage = {
    readonly type: "UploadImage";
    readonly file: File;
    readonly callback: (uploaded: UploadFileResponse | Error) => void;
};

export type EditorSelectProfile = {
    readonly type: "EditorSelectProfile";
    readonly member: Profile_Nostr_Event;
};

type EditorProps = {
    readonly placeholder: string;
    readonly maxHeight: string;
    readonly emit: emitFunc<EditorEvent>;
    readonly sub: EventSubscriber<UI_Interaction_Event>;
    readonly getters: {
        getProfileByPublicKey: func_GetProfileByPublicKey;
        getProfilesByText: func_GetProfilesByText;
    };
    readonly nip96?: boolean;
};

export type EditorState = {
    text: string;
    files: Blob[];
    replyTo?: Parsed_Event;
    matching?: string;
    searchResults: Profile_Nostr_Event[];
};

export class Editor extends Component<EditorProps, EditorState> {
    state: Readonly<EditorState> = {
        text: "",
        files: [],
        searchResults: [],
    };

    textareaElement = createRef<HTMLTextAreaElement>();

    async componentDidMount() {
        for await (const event of this.props.sub.onChange()) {
            if (event.type == "ReplyToMessage") {
                await setState(this, {
                    replyTo: event.event,
                });
            } else if (event.type == "EditorSelectProfile") {
                const regex = /@\w+$/;
                const text = this.state.text.replace(
                    regex,
                    `nostr:${event.member.publicKey.bech32()} `,
                );
                await setState(this, {
                    text,
                    matching: undefined,
                    searchResults: [],
                });
                this.textareaElement.current?.focus();
            }
        }
    }

    render(props: EditorProps, _state: EditorState) {
        const uploadFileInput = createRef();

        return (
            <div class="relative flex flex-col p-2 justify-center bg-[#36393F]">
                <div class="w-full flex items-end gap-2">
                    <button
                        class="flex items-center justify-center group
                        w-10 h-10 rounded-[50%]
                        hover:bg-[#3F3F46] focus:outline-none focus-visible:outline-none"
                        onClick={() => {
                            if (uploadFileInput.current) {
                                uploadFileInput.current.click();
                            }
                        }}
                    >
                        <ImageIcon
                            class="h-8 w-8 stroke-current text-[#FFFFFF4D] group-hover:text-[#FFFFFF]"
                            style={{
                                fill: "none",
                            }}
                        />
                    </button>
                    <input
                        ref={uploadFileInput}
                        type="file"
                        accept="image/*"
                        onChange={this.uploadImage}
                        class="hidden bg-[#FFFFFF2C]"
                    />
                    <div class="flex flex-col flex-1 overflow-hidden bg-[#FFFFFF2C] rounded-xl">
                        {ReplyIndicator({
                            getters: props.getters,
                            replyTo: this.state.replyTo,
                            cancelReply: () => {
                                setState(this, { replyTo: undefined });
                            },
                        })}
                        {this.state.files.length > 0
                            ? (
                                <ul class="flex overflow-auto list-none py-2 w-full border-b border-[#FFFFFF99]">
                                    {this.state.files.map((file, index) => {
                                        return (
                                            <li class="flex items-center justify-center relative mx-2 min-w-[10rem] w-[10rem]  h-[10rem] p-2">
                                                <button
                                                    class="flex items-center justify-center
                                                    w-[2rem] h-[2rem] absolute top-1 right-1 rounded-[50%]
                                                    hover:bg-[#3F3F46] focus:outline-none focus-visible:outline-none"
                                                    onClick={() => {
                                                        this.removeFile(index);
                                                    }}
                                                >
                                                    <RemoveIcon
                                                        class="w-[1.3rem] h-[1.3rem]"
                                                        style={{
                                                            fill: "none",
                                                            stroke: "#FFF",
                                                        }}
                                                    />
                                                </button>
                                                <img
                                                    class="max-w-full max-h-full"
                                                    src={URL.createObjectURL(file)}
                                                    alt=""
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )
                            : undefined}

                        <div class="flex flex-1">
                            <textarea
                                ref={this.textareaElement}
                                style={{
                                    maxHeight: this.props.maxHeight,
                                }}
                                value={this.state.text}
                                rows={1}
                                class="flex-1 px-4 py-[0.5rem] bg-transparent focus-visible:outline-none placeholder-[#FFFFFF4D] text-[#FFFFFF99] whitespace-nowrap resize-none overflow-x-hidden overflow-y-auto"
                                placeholder={this.props.placeholder}
                                onInput={this.handleMessageInput}
                                onKeyDown={async (e) => {
                                    // https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/metaKey
                                    if (e.code === "Enter" && (e.ctrlKey || e.metaKey)) {
                                        await this.sendMessage();
                                    }
                                }}
                                onPaste={async (_) => {
                                    let clipboardData: ClipboardItems = [];
                                    try {
                                        clipboardData = await window.navigator.clipboard.read();
                                    } catch (e) {
                                        console.error(e.message);
                                        return;
                                    }
                                    for (const item of clipboardData) {
                                        try {
                                            const image = await item.getType(
                                                "image/png",
                                            );
                                            await setState(this, {
                                                files: this.state.files.concat([image]),
                                            });
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }
                                }}
                            >
                            </textarea>
                            <div class="flex justify-cente items-start hidden md:block cursor-default select-none">
                                <div class="flex justify-center items-center text-[#FFFFFF99] text-sm p-1 m-1 mt-[0.325rem] rounded-[0.625rem] ">
                                    Ctrl + Enter
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        class="inline-flex h-10 w-20 p-2 justify-center items-center gap-[0.5rem] shrink-0 rounded-[1rem] border-[0.125rem] border-solid border-[#FF762C]
                        hover:bg-gradient-to-r hover:from-[#FF762C] hover:via-[#FF3A5E] hover:to-[#FF01A9]"
                        onClick={async () => {
                            await this.sendMessage();
                            this.textareaElement.current?.focus();
                        }}
                    >
                        <SendIcon
                            class="h-4 w-4"
                            style={{
                                stroke: "#FFF",
                                fill: "none",
                            }}
                        />
                        <span class="text-[#FFFFFF] font-700 leading-[1.25rem]">Send</span>
                    </button>
                </div>
                {MatchingBar({
                    matching: this.state.matching,
                    searchResults: this.state.searchResults,
                    selectProfile: (member: Profile_Nostr_Event) => {
                        props.emit({
                            type: "EditorSelectProfile",
                            member,
                        });
                    },
                    close: () => {
                        setState(this, { matching: undefined, searchResults: [] });
                    },
                })}
            </div>
        );
    }

    handleMessageInput = async (e: h.JSX.TargetedEvent<HTMLTextAreaElement>) => {
        const text = e.currentTarget.value;
        const regex = /@\w+$/;
        const matched = regex.exec(text);
        const matching = matched ? matched[0].slice(1) : undefined;

        const searchResults = matched
            // todo: pass space url
            ? this.props.getters.getProfilesByText(matched[0].slice(1), undefined).splice(0, 10)
            : [];

        const lines = text.split("\n");
        e.currentTarget.setAttribute(
            "rows",
            `${lines.length}`,
        );
        setState(this, { text, matching, searchResults });
    };

    uploadImage = (e: h.JSX.TargetedEvent<HTMLInputElement>) => {
        const { props, state } = this;
        const selectedFiles = e.currentTarget.files;
        if (!selectedFiles) {
            return;
        }
        if (props.nip96) {
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
                    const { text: previousText } = this.state;
                    if (previousText.length > 0) {
                        setState(this, {
                            text: previousText + ` ${image_url} `,
                        });
                    } else {
                        setState(this, {
                            text: `${image_url} `,
                        });
                    }
                },
            });
        } else {
            let previousFiles = state.files;
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                if (!file) {
                    continue;
                }
                previousFiles = previousFiles.concat([file]);
            }
            setState(this, {
                files: previousFiles,
            });
        }
    };

    sendMessage = async () => {
        this.props.emit({
            type: "SendMessage",
            files: this.state.files,
            text: this.state.text,
            reply_to_event_id: this.state.replyTo?.id,
        });
        this.textareaElement.current?.setAttribute(
            "rows",
            "1",
        );
        await setState(this, { text: "", files: [], replyTo: undefined });
    };

    removeFile = (index: number) => {
        const files = this.state.files;
        const newFiles = files.slice(0, index).concat(files.slice(index + 1));
        this.setState({
            files: newFiles,
        });
    };
}

function MatchingBar(props: {
    matching?: string;
    searchResults: Profile_Nostr_Event[];
    selectProfile: (member: Profile_Nostr_Event) => void;
    close: () => void;
}) {
    if (!props.matching) return undefined;
    return (
        <div
            class="absolute z-10"
            style={{
                left: `3.5rem`,
                width: `calc(100% - 9.5rem)`,
                bottom: `calc(100% + 0.5rem)`,
            }}
        >
            <div class="w-full p-2 rounded-lg bg-[#2B2D31] shadow-lg">
                <div class="flex justify-between item-center">
                    <div class="text-[#B6BAC0]">
                        Profiles matching <span class="text-white">@{props.matching}</span>
                    </div>
                    <button
                        class="h-6 w-6 flex justify-center items-center shrink-0 group"
                        onClick={() => {
                            props.close();
                        }}
                    >
                        <XCircleIcon class="h-4 w-4 text-[#B6BAC0] group-hover:text-[#FFFFFF]" />
                    </button>
                </div>
                <ol>
                    {props.searchResults.map((profile) => {
                        return (
                            <li
                                class="flex items-center justify-start p-1 m-1 hover:bg-[#36373C] rounded-lg cursor-pointer"
                                onClick={() => {
                                    props.selectProfile(profile);
                                }}
                            >
                                <Avatar
                                    class={`h-8 w-8 mr-2 flex-shrink-0`}
                                    picture={profile.profile?.picture || robohash(profile.pubkey)}
                                />
                                <div class="truncate text-white">
                                    {profile.profile?.name || profile.profile?.display_name ||
                                        profile.pubkey}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}

function ReplyIndicator(props: {
    replyTo?: Parsed_Event;
    cancelReply: () => void;
    getters: {
        getProfileByPublicKey: func_GetProfileByPublicKey;
    };
}) {
    if (!props.replyTo) {
        return undefined;
    }

    const authorPubkey = props.replyTo.publicKey;
    const profile = props.getters.getProfileByPublicKey(authorPubkey, undefined)?.profile;
    let replyToAuthor = profile?.name || profile?.display_name;
    if (!replyToAuthor) {
        replyToAuthor = authorPubkey.bech32();
    } else {
        replyToAuthor = `@${replyToAuthor}`;
    }
    return (
        <div class="h-10 w-full flex flex-row justify-between items-center text-[#B6BAC0] bg-[#2B2D31] px-4 rounded-t-lg">
            <div class="w-3/4 cursor-default select-none">
                <div class="text-left overflow-hidden whitespace-nowrap truncate">
                    {`Replying to `}
                    <span class="font-bold">
                        {replyToAuthor}
                    </span>
                </div>
            </div>
            <button
                class="h-6 w-6 flex justify-center items-center shrink-0 group"
                onClick={() => {
                    props.cancelReply();
                }}
            >
                <XCircleIcon class="h-4 w-4 group-hover:text-[#FFFFFF]" />
            </button>
        </div>
    );
}
