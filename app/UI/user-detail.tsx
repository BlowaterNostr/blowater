/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { Avatar } from "./components/avatar.tsx";
import { PublicKey } from "@blowater/nostr-sdk";
import { ProfileData } from "../features/profile.ts";
import { emitFunc } from "../event-bus.ts";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { HomeIcon } from "./icons/home-icon.tsx";
import { KeyIcon } from "./icons/key-icon.tsx";
import { UserIcon } from "./icons/user-icon.tsx";
import { CopyButton } from "./components/copy-button.tsx";
import { LinkColor } from "./style/colors.ts";
import { findUrlInString } from "./message.ts";
import { SelectConversation } from "./search_model.ts";
import { CloseRightPanel } from "./components/right-panel.tsx";
import { robohash } from "@blowater/nostr-sdk";

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
        <div class={`px-2 py-3 text-[#7A818C]`}>
            <Avatar
                class={`w-64 h-64 m-auto`}
                picture={props.targetUserProfile.picture || robohash(props.pubkey.hex)}
            />
            <div class="flex flex-col items-center">
                <h1
                    class={`text-[#F3F4EA] truncate text-[1.4rem] my-4 max-w-full text-center` +
                        ` inline-block hover:text-[#60a5fa] hover:cursor-pointer`}
                    onClick={(_) => {
                        props.emit({
                            type: "SelectConversation",
                            pubkey: props.pubkey,
                        });
                        props.emit({
                            type: "CloseRightPanel",
                        });
                    }}
                >
                    {name}
                </h1>
            </div>
            <div class={`flex items-start overflow-hidden w-full group`}>
                <KeyIcon
                    class={`w-6 h-6 mr-2`}
                    style={{
                        fill: "#7A818C",
                    }}
                />
                <p
                    class={`flex-1 text-[#7A818C] group-hover:text-[#F3F4EA] break-words overflow-hidden`}
                >
                    {props.pubkey.bech32()}
                </p>
                <CopyButton text={props.pubkey.bech32()} />
            </div>
            <div class={`flex items-start overflow-hidden w-full mt-1 group`}>
                <KeyIcon
                    class={`w-6 h-6 mr-2`}
                    style={{
                        fill: "#7A818C",
                    }}
                />
                <p
                    class={`flex-1 text-[#7A818C] group-hover:text-[#F3F4EA] break-words overflow-hidden`}
                >
                    {props.pubkey.hex}
                </p>
                <CopyButton text={props.pubkey.hex} />
            </div>
            {props.targetUserProfile.about
                ? (
                    <div class={`flex items-start overflow-hidden w-full mt-4 group`}>
                        <UserIcon
                            class={`w-6 h-6 mr-2`}
                            style={{
                                stroke: "#7A818C",
                                strokeWidth: "1.5",
                                fill: "none",
                            }}
                        />
                        <p
                            class={`flex-1 break-words overflow-hidden`}
                        >
                            {TextWithLinks({ text: props.targetUserProfile.about })}
                        </p>
                    </div>
                )
                : undefined}
            {props.targetUserProfile.website
                ? (
                    <div class={`flex items-start overflow-hidden w-full mt-4 group`}>
                        <HomeIcon
                            class={`w-6 h-6 mr-2`}
                            style={{
                                stroke: "#7A818C",
                                strokeWidth: "1.5",
                                fill: "none",
                            }}
                        />
                        <p
                            class={`flex-1 break-words overflow-hidden`}
                        >
                            {TextWithLinks({ text: props.targetUserProfile.website })}
                        </p>
                    </div>
                )
                : undefined}
            <div class="py-1"></div>
            <div
                class="border inline-block select-none px-1 rounded-full
                hover:text-[#D4D4D4] hover:cursor-pointer"
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
                {props.blocked ? "Unblock" : "Block"}
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
