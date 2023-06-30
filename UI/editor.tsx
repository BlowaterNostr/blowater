/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { IconButtonClass, KeyboradClass } from "./components/tw.ts";
import { DeleteIcon, ImageIcon } from "./icons/mod.tsx";
import { SendIcon } from "./icons/mod.tsx";
import { EventEmitter } from "../event-bus.ts";

import { NostrKind } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { Tag } from "../nostr.ts";

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
                class={tw`w-10 h-10 ${IconButtonClass}`}
                onClick={() => {
                    if (uploadFileInput.current) {
                        uploadFileInput.current.click();
                    }
                }}
            >
                <ImageIcon
                    class={tw`h-8 w-8`}
                    style={{
                        stroke: "#F3F4EA",
                        strokeWidth: "1",
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
                class={tw`mx-2 p-[0.75rem] bg-[#40444B] rounded-lg flex flex-col flex-1 relative`}
            >
                {props.model.files.length > 0
                    ? (
                        <ul
                            class={tw`flex overflow-auto list-none py-2 mb-2 w-full border-b border-[#474B53]`}
                        >
                            {props.model.files.map((file, index) => {
                                return (
                                    <li
                                        class={tw`relative mx-4`}
                                        style={{ minWidth: "fit-content" }}
                                    >
                                        <button
                                            class={tw`w-6 h-6 absolute top-2 right-[-0.75rem] ${IconButtonClass} bg-[#42464D] hover:bg-[#2F3136]`}
                                            style={{
                                                boxShadow: "2px 2px 5px 0 black",
                                            }}
                                            onClick={() => {
                                                removeFile(index);
                                            }}
                                        >
                                            <DeleteIcon
                                                class={tw`w-4`}
                                                style={{
                                                    fill: "transparent",
                                                    stroke: "#ED4245",
                                                }}
                                            />
                                        </button>
                                        <img
                                            class={tw`h-40`}
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
                    class={tw`flex-1 mr-2 bg-transparent focus-visible:outline-none placeholder-[#72767D] text-[0.8rem] text-[#D2D3D5] whitespace-nowrap resize-none overflow-x-hidden overflow-y-auto`}
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
                <div
                    class={tw`text-right mx-5 my-1 text-[0.618rem] text-[#D2D3D5] absolute right-[-1rem] top-[-1.5rem] mobile:hidden`}
                >
                    <kbd class={tw`${KeyboradClass}`}>Ctrl</kbd>
                    +
                    <kbd class={tw`${KeyboradClass}`}>Enter</kbd>
                </div>
            </div>

            <button
                class={tw`w-20 h-10 text-[#F3F4EA] border-2 border-[#42464D] ${IconButtonClass}`}
                onClick={async () => {
                    await sendMessage();
                    textareaElement.current?.focus();
                }}
            >
                <SendIcon
                    class={tw`h-4 w-4 mr-1`}
                    style={{
                        stroke: "#F3F4EA",
                        strokeWidth: "2",
                        fill: "none",
                        minWidth: "fit-content",
                    }}
                />
                Send
            </button>
        </div>
    );
}
