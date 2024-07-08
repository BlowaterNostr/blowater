/** @jsx h */
import { h } from "preact";
import { Avatar } from "./components/avatar.tsx";
import { PublicKey } from "@blowater/nostr-sdk";
import { ProfileData } from "../features/profile.ts";
import { emitFunc } from "../event-bus.ts";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { LinkColor } from "./style/colors.ts";
import { findUrlInString } from "./message.ts";
import { SelectConversation } from "./search_model.ts";
import { CloseRightPanel } from "./components/right-panel.tsx";
import { robohash } from "@blowater/nostr-sdk";
import { CopyIconV2 } from "./icons/copy-icon-v2.tsx";
import { GlobeIcon } from "./icons/globe-icon.tsx";
import { XCircleIconV2 } from "./icons/x-circle-icon-v2.tsx";

export type BlockUser = {
    type: "BlockUser";
    pubkey: PublicKey;
};

export type UnblockUser = {
    type: "UnblockUser";
    pubkey: PublicKey;
};

type UserDetailProps = {
    targetUserProfile: ProfileData;
    pubkey: PublicKey;
    blocked: boolean;
    emit: emitFunc<DirectMessagePanelUpdate | BlockUser | UnblockUser | SelectConversation | CloseRightPanel>;
};

export function UserDetail(props: UserDetailProps) {
    const name = props.targetUserProfile.name || props.targetUserProfile.display_name ||
        props.pubkey.bech32();
    return (
        <div class={`px-2 py-3 text-white flex flex-col justify-start gap-2`}>
            <Avatar
                class={`w-40 h-40 mb-2`}
                picture={props.targetUserProfile.picture || robohash(props.pubkey.hex)}
            />
            <div
                class={`text-lg font-semibold font-sans leading-7 truncate`}
            >
                {name}
            </div>
            <div>
                <button
                    class="rounded-lg bg-white/5 hover:bg-white/10 flex gap-1 justify-center items-center p-1"
                    onClick={() => navigator.clipboard.writeText(props.pubkey.bech32())}
                >
                    <CopyIconV2 class="w-4 h-4 text-white" />
                    <div class="text-sm font-semibold font-sans leading-5">
                        Public Key
                    </div>
                </button>
            </div>
            {props.targetUserProfile.about
                ? (
                    <p
                        class={`flex-1 break-words overflow-hidden`}
                    >
                        {TextWithLinks({ text: props.targetUserProfile.about })}
                    </p>
                )
                : undefined}
            {props.targetUserProfile.website
                ? (
                    <div class={`flex items-center overflow-hidden w-full gap-1`}>
                        <GlobeIcon class="w-4 h-4 text-neutral-400" />
                        <a
                            class={`flex-1 break-words overflow-hidden text-sm font-normal font-sans leading-5`}
                            href={props.targetUserProfile.website}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {props.targetUserProfile.website}
                        </a>
                    </div>
                )
                : undefined}
            <div class="flex items-center gap-2">
                <button
                    class="rounded-lg bg-blue-600 hover:bg-blue-700 px-2 py-1 text-sm font-semibold font-sans leading-5 hover:cursor-pointer"
                    onClick={() => {
                        props.emit({
                            type: "SelectConversation",
                            pubkey: props.pubkey,
                        });
                        props.emit({
                            type: "CloseRightPanel",
                        });
                    }}
                >
                    Message
                </button>
                <button
                    class="rounded-lg bg-neutral-100 hover:bg-white px-2 py-1 text-neutral-600 hover:text-neutral-800 text-sm font-semibold font-sans leading-5 hover:cursor-pointer flex items-center gap-1"
                    onClick={() => {
                        if (props.blocked) {
                            props.emit({
                                type: "UnblockUser",
                                pubkey: props.pubkey,
                            });
                        } else {
                            props.emit({
                                type: "BlockUser",
                                pubkey: props.pubkey,
                            });
                        }
                    }}
                >
                    <XCircleIconV2 class="w-4 h-4" />
                    {props.blocked ? "Unblock" : "Block"}
                </button>
            </div>
        </div>
    );
}

function TextWithLinks({ text }: { text: string }) {
    const parts = findUrlInString(text);

    return (
        <div>
            {parts.map((part, index) => {
                if (part instanceof URL) {
                    return (
                        <a
                            class={`text-[${LinkColor}] hover:text-[#F3F4EA]`}
                            key={index}
                            href={part.href}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {part.href}
                        </a>
                    );
                } else {
                    return <span key={index}>{part}</span>;
                }
            })}
        </div>
    );
}
