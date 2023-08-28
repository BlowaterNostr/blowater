/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { NoteID } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nip19.ts";
import { InputClass } from "./components/tw.ts";
import { AboutIcon } from "./icons/about-icon.tsx";
import { PrimaryTextColor, TitleIconColor } from "./style/colors.ts";
import { PlainText_Nostr_Event } from "../nostr.ts";
import { CopyButton } from "./components/copy-button.tsx";
import { NostrEvent } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

export function PlainTextEventDetail(plainTextEvent: PlainText_Nostr_Event) {
    const eventID = plainTextEvent.id;
    const eventIDBech32 = NoteID.FromString(plainTextEvent.id).bech32();
    const authorPubkey = plainTextEvent.publicKey.hex;
    const authorPubkeyBech32 = plainTextEvent.publicKey.bech32();
    const content = plainTextEvent.content;
    const originalEventRaw = JSON.stringify(
        {
            content: plainTextEvent.content,
            created_at: plainTextEvent.created_at,
            kind: plainTextEvent.kind,
            tags: plainTextEvent.tags,
            pubkey: plainTextEvent.pubkey,
            id: plainTextEvent.id,
            sig: plainTextEvent.sig,
        },
        null,
        4,
    );

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
                    class={tw`${InputClass} overflow-x-auto pr-[4rem]`}
                />
                <CopyButton
                    copyContent={eventIDBech32}
                    class={tw`absolute right-4 top-4`}
                />
            </div>
            <div class={tw`relative mt-4`}>
                <input
                    value={eventID}
                    disabled
                    type="text"
                    class={tw`${InputClass} overflow-x-auto pr-[4rem]`}
                />
                <CopyButton
                    copyContent={eventID}
                    class={tw`absolute right-4 top-4`}
                />
            </div>

            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Author</p>
            <div class={tw`relative`}>
                <input
                    value={authorPubkeyBech32}
                    disabled
                    type="text"
                    class={tw`${InputClass} overflow-x-auto pr-[4rem]`}
                />
                <CopyButton
                    copyContent={authorPubkeyBech32}
                    class={tw`absolute right-4 top-4`}
                />
            </div>
            <div class={tw`relative mt-4`}>
                <input
                    value={authorPubkey}
                    disabled
                    type="text"
                    class={tw`${InputClass} overflow-x-auto pr-[4rem]`}
                />
                <CopyButton
                    copyContent={authorPubkey}
                    class={tw`absolute right-4 top-4`}
                />
            </div>

            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Content</p>
            <div class={tw`relative`}>
                <input
                    value={content}
                    disabled
                    type="text"
                    class={tw`${InputClass} overflow-x-auto pr-[4rem]`}
                />
                <CopyButton
                    copyContent={content}
                    class={tw`absolute right-4 top-4`}
                />
            </div>

            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Raw</p>
            <div class={tw`relative`}>
                <pre class={tw`${InputClass} pr-[4rem] whitespace-pre resize-none overflow-x-auto`}>
                    {originalEventRaw}
                </pre>
                <CopyButton
                    copyContent={originalEventRaw}
                    class={tw`absolute right-4 top-4`}
                />
            </div>
        </div>
    );
}
