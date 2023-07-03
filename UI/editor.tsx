/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import {
    CenterClass,
    IconButtonClass,
    KeyboradClass,
    LinearGradientsClass,
    NoOutlineClass,
} from "./components/tw.ts";
import { EventEmitter } from "../event-bus.ts";

import { NostrKind } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { Tag } from "../nostr.ts";
import { ImageIcon } from "./icons2/image-icon.tsx";
import {
    DividerBackgroundColor,
    HoverButtonBackgroudColor,
    PrimaryBackgroundColor,
    PrimaryTextColor,
} from "./style/colors.ts";
import { SendIcon } from "./icons2/send-icon.tsx";
import { RemoveIcon } from "./icons2/remove-icon.tsx";

export type EditorModel = DM_EditorModel | Social_EditorModel;

export type DM_EditorModel = {
    id: string;
    text: string;
    files: Blob[];
    tags: Tag[];
    readonly target: DM_Target;
};

export type Social_EditorModel = {
    id: string;
    text: string;
    files: Blob[];
    tags: Tag[];
    readonly target: Social_Target;
};

export type EditorSubmissionTarget = DM_Target | Social_Target;

export type DM_Target = {
    kind: NostrKind.DIRECT_MESSAGE;
    receiver: {
        pubkey: PublicKey;
        name?: string;
        picture?: string;
    };
};
export type Social_Target = {
    kind: NostrKind.TEXT_NOTE;
};

export function new_DM_EditorModel(receiver: {
    pubkey: PublicKey;
    name?: string;
    picture?: string;
}): DM_EditorModel {
    return {
        id: receiver.pubkey.hex,
        text: "",
        files: [],
        tags: [],
        target: {
            kind: NostrKind.DIRECT_MESSAGE,
            receiver,
        },
    };
}

export function new_Social_EditorModel(): Social_EditorModel {
    return {
        id: "social",
        text: "",
        files: [],
        tags: [],
        target: {
            kind: NostrKind.TEXT_NOTE,
        },
    };
}

export type EditorEvent = SendMessage | UpdateMessageText | UpdateMessageFiles;

export type SendMessage = {
    readonly type: "SendMessage";
    readonly id: string;
    readonly target: EditorSubmissionTarget;
    text: string;
    files: Blob[];
    tags: Tag[];
};

export type UpdateMessageText = {
    readonly type: "UpdateMessageText";
    readonly id: string;
    readonly target: EditorSubmissionTarget;
    readonly text: string;
};
export type UpdateMessageFiles = {
    readonly type: "UpdateMessageFiles";
    readonly id: string;
    readonly target: EditorSubmissionTarget;
    readonly files: Blob[];
};

export function Editor(props: {
    // UI
    readonly placeholder: string;
    readonly maxHeight: string;
    // Logic
    readonly model: EditorModel;
    //
    readonly eventEmitter: EventEmitter<EditorEvent>;
}) {
    const textareaElement = createRef();
    const uploadFileInput = createRef();

    const removeFile = (index: number) => {
        props.eventEmitter.emit({
            type: "UpdateMessageFiles",
            id: props.model.id,
            target: props.model.target,
            files: props.model.files.slice(0, index).concat(
                props.model.files.slice(index + 1),
            ),
        });
    };

    const sendMessage = async () => {
        props.eventEmitter.emit({
            type: "SendMessage",
            id: props.model.id,
            tags: props.model.tags,
            target: props.model.target,
            files: props.model.files,
            text: props.model.text,
        });
        textareaElement.current.setAttribute(
            "rows",
            "1",
        );
    };

    return (
        <div class={tw`flex mb-4 mx-5 items-end`}>
            <button
                class={tw`min-w-[3rem] w-[3rem] h-[3rem] hover:bg-[${DividerBackgroundColor}] group ${CenterClass} rounded-[50%] ${NoOutlineClass}`}
                onClick={() => {
                    if (uploadFileInput.current) {
                        uploadFileInput.current.click();
                    }
                }}
            >
                <ImageIcon
                    class={tw`h-[2rem] w-[2rem] stroke-current text-[${PrimaryTextColor}4D] group-hover:text-[${PrimaryTextColor}]`}
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
                    let propsfiles = props.model.files;
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
                    props.eventEmitter.emit({
                        type: "UpdateMessageFiles",
                        id: props.model.id,
                        target: props.model.target,
                        files: propsfiles,
                    });
                }}
                class={tw`hidden`}
            />
            <div
                class={tw`mx-2 p-[0.75rem] bg-[${DividerBackgroundColor}] rounded-lg flex flex-col flex-1 relative overflow-hidden`}
            >
                {props.model.files.length > 0
                    ? (
                        <ul
                            class={tw`flex overflow-auto list-none py-2 w-full border-b border-[#52525B] mb-[1rem]`}
                        >
                            {props.model.files.map((file, index) => {
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
                    value={props.model.text}
                    rows={1}
                    class={tw`flex-1 mr-[4.5rem] bg-transparent focus-visible:outline-none placeholder-[${PrimaryTextColor}4D] text-[0.8rem] text-[#D2D3D5] whitespace-nowrap resize-none overflow-x-hidden overflow-y-auto`}
                    placeholder={props.placeholder}
                    onInput={(e) => {
                        props.eventEmitter.emit({
                            type: "UpdateMessageText",
                            id: props.model.id,
                            target: props.model.target,
                            text: e.currentTarget.value,
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
                            console.log(e.message);
                            // todo: global error toast
                            return;
                        }
                        for (const item of clipboardData) {
                            try {
                                const image = await item.getType(
                                    "image/png",
                                );
                                props.eventEmitter.emit({
                                    type: "UpdateMessageFiles",
                                    id: props.model.id,
                                    target: props.model.target,
                                    files: props.model.files.concat([image]),
                                });
                            } catch (e) {
                                console.error(e);
                            }
                        }
                    }}
                >
                </textarea>
                <span
                    class={tw`absolute block right-[0.5rem] bottom-[0.3rem] p-[0.5rem] text-[${PrimaryTextColor}B2] text-[0.75rem]`}
                >
                    Ctrl+Enter
                </span>
            </div>

            <div class={tw`w-[5rem] h-[2.5rem] rounded-lg ${LinearGradientsClass} ${CenterClass}`}>
                <button
                    class={tw`w-[4.8rem] h-[2.3rem] text-[${PrimaryTextColor}] rounded-lg ${CenterClass} bg-[#36393F] hover:bg-transparent font-bold`}
                    onClick={async () => {
                        await sendMessage();
                        textareaElement.current?.focus();
                    }}
                >
                    <SendIcon
                        class={tw`h-[1.25rem] w-[1.25rem] mr-[0.5rem]`}
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
