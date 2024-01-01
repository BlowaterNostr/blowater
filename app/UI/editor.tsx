/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.17.1";
import { CenterClass, LinearGradientsClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";

import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { ImageIcon } from "./icons/image-icon.tsx";
import { DividerBackgroundColor, PrimaryBackgroundColor, PrimaryTextColor } from "./style/colors.ts";
import { SendIcon } from "./icons/send-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { RemoveIcon } from "./icons/remove-icon.tsx";
import { isMobile } from "./_helper.ts";

export type EditorModel = {
    readonly pubkey: PublicKey;
    text: string;
    files: Blob[];
};

export function new_DM_EditorModel(
    pubkey: PublicKey,
): EditorModel {
    return {
        pubkey: pubkey,
        text: "",
        files: [],
    };
}

export type EditorEvent = SendMessage | UpdateEditorText | UpdateMessageFiles;

export type SendMessage = {
    readonly type: "SendMessage";
    readonly pubkey: PublicKey;
    text: string;
    files: Blob[];
    isGroupChat: boolean;
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
    // Logic
    readonly targetNpub: PublicKey;
    readonly text: string;
    files: Blob[];
    //
    readonly emit: emitFunc<EditorEvent>;
    readonly isGroupChat: boolean;
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

    componentDidMount(): void {
        this.setState({
            text: this.props.text,
            files: this.props.files,
        });
    }

    componentWillReceiveProps(nextProps: Readonly<EditorProps>) {
        if (!isMobile()) {
            this.textareaElement.current.focus();
        }
    }

    textareaElement = createRef();

    sendMessage = async () => {
        const props = this.props;
        props.emit({
            type: "SendMessage",
            pubkey: props.targetNpub,
            files: props.files,
            text: props.text,
            isGroupChat: props.isGroupChat,
        });
        this.textareaElement.current.setAttribute(
            "rows",
            "1",
        );
        this.setState({ text: "", files: [] });
    };

    removeFile = (index: number) => {
        const files = this.state.files;
        const newFiles = files.slice(0, index).concat(files.slice(index + 1));
        this.props.emit({
            type: "UpdateMessageFiles",
            files: newFiles,
            pubkey: this.props.targetNpub,
            isGroupChat: this.props.isGroupChat,
        });
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
                        this.props.emit({
                            type: "UpdateMessageFiles",
                            files: propsfiles,
                            pubkey: this.props.targetNpub,
                            isGroupChat: this.props.isGroupChat,
                        });
                        this.setState({
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
                            this.props.emit({
                                type: "UpdateEditorText",
                                pubkey: this.props.targetNpub,
                                text: e.currentTarget.value,
                                isGroupChat: this.props.isGroupChat,
                            });
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
                                    this.props.emit({
                                        type: "UpdateMessageFiles",
                                        isGroupChat: this.props.isGroupChat,
                                        pubkey: this.props.targetNpub,
                                        files: this.props.files.concat([image]),
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
