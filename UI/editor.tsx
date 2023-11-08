/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { CenterClass, LinearGradientsClass, NoOutlineClass } from "./components/tw.ts";
import { emitFunc } from "../event-bus.ts";

import { PublicKey } from "../lib/nostr-ts/key.ts";
import { ImageIcon } from "./icons/image-icon.tsx";
import { DividerBackgroundColor, PrimaryBackgroundColor, PrimaryTextColor } from "./style/colors.ts";
import { SendIcon } from "./icons/send-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { RemoveIcon } from "./icons/remove-icon.tsx";

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

export class Editor extends Component<EditorProps> {
    render(props: EditorProps) {
        const textareaElement = createRef();
        const uploadFileInput = createRef();

        const removeFile = (index: number) => {
            props.emit({
                type: "UpdateMessageFiles",
                files: props.files.slice(0, index).concat(
                    props.files.slice(index + 1),
                ),
                pubkey: props.targetNpub,
                isGroupChat: props.isGroupChat,
            });
        };

        const sendMessage = async () => {
            props.emit({
                type: "SendMessage",
                pubkey: props.targetNpub,
                files: props.files,
                text: props.text,
                isGroupChat: props.isGroupChat,
            });
            textareaElement.current.setAttribute(
                "rows",
                "1",
            );
        };

        return (
            <div class={tw`flex mb-4 mx-5 mobile:mx-2 mobile:mb-2 items-end`}>
                <button
                    class={tw`min-w-[3rem] mobile:min-w-[2rem] w-[3rem] mobile:w-8 h-[3rem] mobile:h-8 hover:bg-[${DividerBackgroundColor}] group ${CenterClass} rounded-[50%] ${NoOutlineClass}`}
                    onClick={() => {
                        if (uploadFileInput.current) {
                            uploadFileInput.current.click();
                        }
                    }}
                >
                    <ImageIcon
                        class={tw`h-[2rem] w-[2rem] mobile:w-6 mobile:h-6 stroke-current text-[${PrimaryTextColor}4D] group-hover:text-[${PrimaryTextColor}]`}
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
                        let propsfiles = props.files;
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
                        props.emit({
                            type: "UpdateMessageFiles",
                            files: propsfiles,
                            pubkey: props.targetNpub,
                            isGroupChat: props.isGroupChat,
                        });
                    }}
                    class={tw`hidden`}
                />
                <div
                    class={tw`mx-2 p-[0.75rem] mobile:p-2 mobile:text-sm bg-[${DividerBackgroundColor}] rounded-lg flex flex-col flex-1 overflow-hidden`}
                >
                    {props.files.length > 0
                        ? (
                            <ul
                                class={tw`flex overflow-auto list-none py-2 w-full border-b border-[#52525B] mb-[1rem]`}
                            >
                                {props.files.map((file, index) => {
                                    return (
                                        <li
                                            class={tw`relative mx-2 min-w-[10rem] w-[10rem]  h-[10rem] p-2 bg-[${PrimaryBackgroundColor}] rounded ${CenterClass}`}
                                        >
                                            <button
                                                class={tw`w-[2rem] h-[2rem] absolute top-1 right-1 rounded-[50%] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                                                onClick={() => {
                                                    removeFile(index);
                                                }}
                                            >
                                                <RemoveIcon
                                                    class={tw`w-[1.3rem] h-[1.3rem]`}
                                                    style={{
                                                        fill: "none",
                                                        stroke: PrimaryTextColor,
                                                    }}
                                                />
                                            </button>
                                            <img
                                                class={tw`max-w-full max-h-full`}
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
                        ref={textareaElement}
                        style={{
                            maxHeight: props.maxHeight,
                        }}
                        value={props.text}
                        rows={1}
                        class={tw`flex-1 bg-transparent focus-visible:outline-none placeholder-[${PrimaryTextColor}4D] text-[0.8rem] text-[#D2D3D5] whitespace-nowrap resize-none overflow-x-hidden overflow-y-auto`}
                        placeholder={props.placeholder}
                        onInput={(e) => {
                            props.emit({
                                type: "UpdateEditorText",
                                pubkey: props.targetNpub,
                                text: e.currentTarget.value,
                                isGroupChat: props.isGroupChat,
                            });
                            const lines = e.currentTarget.value.split("\n");
                            e.currentTarget.setAttribute(
                                "rows",
                                `${lines.length}`,
                            );
                        }}
                        onKeyDown={async (e) => {
                            if (e.code === "Enter" && e.ctrlKey) {
                                await sendMessage();
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
                                    props.emit({
                                        type: "UpdateMessageFiles",
                                        isGroupChat: props.isGroupChat,
                                        pubkey: props.targetNpub,
                                        files: props.files.concat([image]),
                                    });
                                } catch (e) {
                                    console.error(e);
                                }
                            }
                        }}
                    >
                    </textarea>
                </div>

                <div
                    class={tw`w-[5rem] h-[2.5rem] mobile:w-12 mobile:h-8 rounded-lg ${LinearGradientsClass} ${CenterClass}`}
                >
                    <button
                        class={tw`w-[4.8rem] h-[2.3rem] mobile:w-[2.9rem] mobile:h-[1.9rem] mobile:text-sm text-[${PrimaryTextColor}] rounded-lg ${CenterClass} bg-[#36393F] hover:bg-transparent font-bold`}
                        onClick={async () => {
                            await sendMessage();
                            textareaElement.current?.focus();
                        }}
                    >
                        <SendIcon
                            class={tw`h-[1.25rem] w-[1.25rem] mr-[0.1rem] mobile:hidden`}
                            style={{
                                stroke: PrimaryTextColor,
                                fill: "none",
                            }}
                        />
                        Send
                    </button>
                </div>
            </div>
        );
    }
}
