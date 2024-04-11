/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.17.1";
import { emitFunc } from "../event-bus.ts";

import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { ImageIcon } from "./icons/image-icon.tsx";
import { SendIcon } from "./icons/send-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { RemoveIcon } from "./icons/remove-icon.tsx";
import { isMobile, setState } from "./_helper.ts";
import { XCircleIcon } from "./icons/x-circle-icon.tsx";
import { func_GetEventByID } from "./message-list.tsx";
import { ProfileGetter } from "./search.tsx";
import { NoteID } from "../../libs/nostr.ts/nip19.ts";

export type EditorEvent = SendMessage | UpdateEditorText | UpdateMessageFiles;

export type SendMessage = {
    readonly type: "SendMessage";
    readonly text: string;
    readonly files: Blob[];
    readonly reply_to_event_id?: string | NoteID;
};

export type UpdateEditorText = {
    readonly type: "UpdateEditorText";
    readonly pubkey: PublicKey;
    readonly isGroupChat: boolean;
    readonly text: string;
};
export type UpdateMessageFiles = {
    readonly type: "UpdateMessageFiles";
    readonly pubkey: PublicKey;
    readonly isGroupChat: boolean;
    readonly files: Blob[];
};

type EditorProps = {
    readonly replyTo?: {
        eventID?: string | NoteID;
        onEventIDChange: (eventID?: string | NoteID) => void;
    };
    readonly placeholder: string;
    readonly maxHeight: string;
    readonly emit: emitFunc<EditorEvent>;
    readonly getters: {
        getEventByID: func_GetEventByID;
        profileGetter: ProfileGetter;
    };
};

export type EditorState = {
    text: string;
    files: Blob[];
};

export class Editor extends Component<EditorProps, EditorState> {
    state: Readonly<EditorState> = {
        text: "",
        files: [],
    };

    textareaElement = createRef<HTMLTextAreaElement>();

    sendMessage = async () => {
        const props = this.props;
        props.emit({
            type: "SendMessage",
            files: this.state.files,
            text: this.state.text,
            reply_to_event_id: this.props.replyTo?.eventID,
        });
        this.textareaElement.current?.setAttribute(
            "rows",
            "1",
        );
        this.props.replyTo?.onEventIDChange(undefined);
        await setState(this, { text: "", files: [] });
    };

    removeFile = (index: number) => {
        const files = this.state.files;
        const newFiles = files.slice(0, index).concat(files.slice(index + 1));
        this.setState({
            files: newFiles,
        });
    };

    render(props: EditorProps, state: EditorState) {
        const uploadFileInput = createRef();

        return (
            <div class="flex flex-col mb-4 mx-4 justify-center rounded-lg">
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
                        multiple
                        onChange={async (e) => {
                            let propsfiles = this.state.files;
                            const files = e.currentTarget.files;
                            if (!files) {
                                return;
                            }
                            for (let i = 0; i < files.length; i++) {
                                const file = files.item(i);
                                if (!file) {
                                    continue;
                                }
                                propsfiles = propsfiles.concat([file]);
                            }
                            await setState(this, {
                                files: propsfiles,
                            });
                        }}
                        class="hidden bg-[#FFFFFF2C]"
                    />
                    <div class="flex flex-col flex-1 overflow-hidden bg-[#FFFFFF2C] rounded-xl">
                        {ReplyIndicator({
                            getters: props.getters,
                            replyTo: props.replyTo,
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
                                onInput={(e) => {
                                    const lines = e.currentTarget.value.split("\n");
                                    e.currentTarget.setAttribute(
                                        "rows",
                                        `${lines.length}`,
                                    );
                                    this.setState({ text: e.currentTarget.value });
                                }}
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
                            <div class="flex justify-cente items-start hidden md:block">
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
            </div>
        );
    }
}

function ReplyIndicator(props: {
    readonly replyTo?: {
        eventID?: string | NoteID;
        onEventIDChange: (eventID?: string | NoteID) => void;
    };
    getters: {
        getEventByID: func_GetEventByID;
        profileGetter: ProfileGetter;
    };
}) {
    if (!props.replyTo || !props.replyTo.eventID) {
        return undefined;
    }
    const ctx = props.getters.getEventByID(props.replyTo.eventID)?.publicKey;
    if (!ctx) {
        return undefined;
    }
    const profile = props.getters.profileGetter.getProfilesByPublicKey(ctx)?.profile;
    let replyToAuthor = profile?.name || profile?.display_name;
    if (!replyToAuthor) {
        replyToAuthor = ctx.bech32();
    } else {
        replyToAuthor = `@${replyToAuthor}`;
    }
    return (
        <div class="h-10 w-full flex flex-row justify-between items-center text-[#B6BAC0] bg-[#2B2D31] px-4 rounded-t-lg">
            <button class="w-3/4">
                <div class="text-left overflow-hidden whitespace-nowrap truncate">
                    {`Replying to `}
                    <span class="font-bold">
                        {replyToAuthor}
                    </span>
                </div>
            </button>
            <button
                class="h-6 w-6 flex justify-center items-center shrink-0"
                onClick={() => {
                    props.replyTo?.onEventIDChange(undefined);
                }}
            >
                <XCircleIcon class="h-4 w-4" />
            </button>
        </div>
    );
}
