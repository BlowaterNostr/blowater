/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { Avatar } from "./components/avatar.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { ProfileData } from "../features/profile.ts";
import { emitFunc } from "../event-bus.ts";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";
import { HomeIcon } from "./icons/home-icon.tsx";
import { KeyIcon } from "./icons/key-icon.tsx";
import { UserIcon } from "./icons/user-icon.tsx";
import { CopyButton } from "./components/copy-button.tsx";
import { LinkColor } from "./style/colors.ts";
import { findUrlInString } from "./message.ts";

type UserDetailProps = {
    targetUserProfile: ProfileData;
    pubkey: PublicKey;
    emit: emitFunc<DirectMessagePanelUpdate>;
};

export function UserDetail(props: UserDetailProps) {
    return (
        <div class={`p-2 relative text-[#7A818C]`}>
            <Avatar
                class={`w-64 h-64 m-auto mt-8`}
                picture={props.targetUserProfile.picture}
            />
            <h1 class={`text-[#F3F4EA] truncate text-[1.4rem] mt-8 max-w-full text-center`}>
                {props.targetUserProfile.name || props.pubkey.bech32()}
            </h1>
            <div class={`flex items-start overflow-hidden w-full mt-8 group`}>
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
