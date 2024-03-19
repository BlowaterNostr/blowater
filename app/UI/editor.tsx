/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.17.1";
import { CenterClass, LinearGradientsClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";

import { NostrKind } from "../../libs/nostr.ts/nostr.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { ImageIcon } from "./icons/image-icon.tsx";
import { DividerBackgroundColor, PrimaryBackgroundColor, PrimaryTextColor } from "./style/colors.ts";
import { SendIcon } from "./icons/send-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { RemoveIcon } from "./icons/remove-icon.tsx";
import { isMobile, setState } from "./_helper.ts";
import { Tag } from "../nostr.ts";
import { parseContent } from "./message.ts";
import { generateTags } from "./editor.ts";

export type EditorEvent = SendMessage | UpdateEditorText | UpdateMessageFiles;

export type SendMessage = {
    readonly type: "SendMessage";
    readonly text: string;
    readonly files: Blob[];
};

type EditorID = {
    type: "Pubkey";
    pubkey: PublicKey;
} | {
    type: "relay";
    relay: string;
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
    // UI
    readonly placeholder: string;
    readonly maxHeight: string;
    //
    readonly emit: emitFunc<EditorEvent>;
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
        });
        this.textareaElement.current?.setAttribute(
            "rows",
            "1",
        );
        await setState(this, { text: "", files: [] });
    };

    removeFile = (index: number) => {
        const files = this.state.files;
        const newFiles = files.slice(0, index).concat(files.slice(index + 1));
        this.setState({
            files: newFiles,
        });
    };

    render() {
        const uploadFileInput = createRef();

        return (
            <div class={`flex mb-4 mx-4 items-center bg-[${DividerBackgroundColor}] rounded-lg`}>
                <button
                    class={`min-w-[3rem] w-[3rem] h-[3rem] hover:bg-[${DividerBackgroundColor}] group ${CenterClass} rounded-[50%] ${NoOutlineClass}`}
                    onClick={() => {
                        if (uploadFileInput.current) {
                            uploadFileInput.current.click();
                        }
                    }}
                >
                    <ImageIcon
                        class={`h-[2rem] w-[2rem] stroke-current text-[${PrimaryTextColor}4D] group-hover:text-[${PrimaryTextColor}]`}
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
                    class={`hidden`}
                />
                <div
                    class={`py-[0.75rem] flex flex-col flex-1 overflow-hidden`}
                >
                    {this.state.files.length > 0
                        ? (
                            <ul
                                class={`flex overflow-auto list-none py-2 w-full border-b border-[#52525B] mb-[1rem]`}
                            >
                                {this.state.files.map((file, index) => {
                                    return (
                                        <li
                                            class={`relative mx-2 min-w-[10rem] w-[10rem]  h-[10rem] p-2 bg-[${PrimaryBackgroundColor}] rounded ${CenterClass}`}
                                        >
                                            <button
                                                class={`w-[2rem] h-[2rem] absolute top-1 right-1 rounded-[50%] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                                                onClick={() => {
                                                    this.removeFile(index);
                                                }}
                                            >
                                                <RemoveIcon
                                                    class={`w-[1.3rem] h-[1.3rem]`}
                                                    style={{
                                                        fill: "none",
                                                        stroke: PrimaryTextColor,
                                                    }}
                                                />
                                            </button>
                                            <img
                                                class={`max-w-full max-h-full`}
                                                src={URL.createObjectURL(file)}
                                                alt=""
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        )
                        : undefined}

                    <textarea
                        ref={this.textareaElement}
                        style={{
                            maxHeight: this.props.maxHeight,
                        }}
                        value={this.state.text}
                        rows={1}
                        class={`flex-1 bg-transparent focus-visible:outline-none placeholder-[${PrimaryTextColor}4D] text-[0.8rem] text-[#D2D3D5] whitespace-nowrap resize-none overflow-x-hidden overflow-y-auto`}
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
                </div>

                <button
                    class={`m-2 w-12 h-8 ${CenterClass} ${LinearGradientsClass} rounded`}
                    onClick={async () => {
                        await this.sendMessage();
                        this.textareaElement.current?.focus();
                    }}
                >
                    <SendIcon
                        class={`h-4 w-4`}
                        style={{
                            stroke: PrimaryTextColor,
                            fill: "none",
                        }}
                    />
                </button>
            </div>
        );
    }
}
