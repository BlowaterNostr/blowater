/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { NoteID } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nip19.ts";
import { CenterClass, InputClass, NoOutlineClass } from "./components/tw.ts";
import { AboutIcon } from "./icons/about-icon.tsx";
import { CopyIcon } from "./icons/copy-icon.tsx";
import { DividerBackgroundColor, PrimaryTextColor, TitleIconColor } from "./style/colors.ts";
import { PlainText_Nostr_Event } from "../nostr.ts";

export function PlainTextEventDetail(plainTextEvent: PlainText_Nostr_Event) {
    const eventID = plainTextEvent.id;
    const eventIDBech32 = NoteID.FromString(plainTextEvent.id).bech32();
    const authorPubkey = plainTextEvent.publicKey.hex;
    const authorPubkeyBech32 = plainTextEvent.publicKey.bech32();
    const content = plainTextEvent.content;
    const originalEventRaw = JSON.stringify(plainTextEvent.originalEvent, null, 4);

    return (
        <div class={tw`py-[1.5rem] px-4`}>
            <p class={tw`text-[${PrimaryTextColor}] text-[1.3125rem] flex`}>
                <AboutIcon
                    class={tw`w-[2rem] h-[2rem] mr-[1rem]`}
                    style={{
                        fill: TitleIconColor,
                    }}
                />
                Details
            </p>
            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Event ID</p>
            <div class={tw`relative`}>
                <input
                    value={eventIDBech32}
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(eventIDBech32);
                    }}
                >
                    <CopyIcon
                        class={tw`w-[1rem] h-[1rem]`}
                        style={{
                            fill: "none",
                            stroke: PrimaryTextColor,
                        }}
                    />
                </button>
            </div>
            <div class={tw`relative mt-4`}>
                <input
                    value={eventID}
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(eventID);
                    }}
                >
                    <CopyIcon
                        class={tw`w-[1rem] h-[1rem]`}
                        style={{
                            fill: "none",
                            stroke: PrimaryTextColor,
                        }}
                    />
                </button>
            </div>

            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Author</p>
            <div class={tw`relative`}>
                <input
                    value={authorPubkeyBech32}
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(authorPubkeyBech32);
                    }}
                >
                    <CopyIcon
                        class={tw`w-[1rem] h-[1rem]`}
                        style={{
                            fill: "none",
                            stroke: PrimaryTextColor,
                        }}
                    />
                </button>
            </div>
            <div class={tw`relative mt-4`}>
                <input
                    value={authorPubkey}
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(authorPubkey);
                    }}
                >
                    <CopyIcon
                        class={tw`w-[1rem] h-[1rem]`}
                        style={{
                            fill: "none",
                            stroke: PrimaryTextColor,
                        }}
                    />
                </button>
            </div>

            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Content</p>
            <div class={tw`relative`}>
                <input
                    value={content}
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(content);
                    }}
                >
                    <CopyIcon
                        class={tw`w-[1rem] h-[1rem]`}
                        style={{
                            fill: "none",
                            stroke: PrimaryTextColor,
                        }}
                    />
                </button>
            </div>

            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Raw</p>
            <div class={tw`relative`}>
                <pre class={tw`${InputClass} truncate pr-[4rem] whitespace-pre resize-none`}>
                    {originalEventRaw}
                </pre>
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(originalEventRaw);
                    }}
                >
                    <CopyIcon
                        class={tw`w-[1rem] h-[1rem]`}
                        style={{
                            fill: "none",
                            stroke: PrimaryTextColor,
                        }}
                    />
                </button>
            </div>
        </div>
    );
}
