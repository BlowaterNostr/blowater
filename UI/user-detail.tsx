/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
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

type UserDetailProps = {
    targetUserProfile: ProfileData;
    pubkey: PublicKey;
    emit: emitFunc<DirectMessagePanelUpdate>;
};

export function UserDetail(props: UserDetailProps) {
    return (
        <div class={tw`p-2 relative`}>
            <Avatar
                class={tw`w-64 h-64 m-auto mt-8`}
                picture={props.targetUserProfile.picture}
            />
            <h1 class={tw`text-[#F3F4EA] truncate text-[1.4rem] mt-8 max-w-full text-center`}>
                {props.targetUserProfile.name || props.pubkey.bech32()}
            </h1>
            <div class={tw`flex items-start overflow-hidden w-full mt-8 group`}>
                <KeyIcon
                    class={tw`w-6 h-6 mr-2`}
                    style={{
                        fill: "#7A818C",
                    }}
                />
                <p
                    class={tw`flex-1 text-[#7A818C] group-hover:text-[#F3F4EA] break-words overflow-hidden`}
                >
                    {props.pubkey.bech32()}
                </p>
                <CopyButton text={props.pubkey.bech32()} />
            </div>
            <div class={tw`flex items-start overflow-hidden w-full mt-1 group`}>
                <KeyIcon
                    class={tw`w-6 h-6 mr-2`}
                    style={{
                        fill: "#7A818C",
                    }}
                />
                <p
                    class={tw`flex-1 text-[#7A818C] group-hover:text-[#F3F4EA] break-words overflow-hidden`}
                >
                    {props.pubkey.hex}
                </p>
                <CopyButton text={props.pubkey.hex} />
            </div>
            {props.targetUserProfile.about
                ? (
                    <div class={tw`flex items-start overflow-hidden w-full mt-4 group`}>
                        <UserIcon
                            class={tw`w-6 h-6 mr-2`}
                            style={{
                                stroke: "#7A818C",
                                strokeWidth: "1.5",
                                fill: "none",
                            }}
                        />
                        <p
                            class={tw`flex-1 text-[#7A818C] group-hover:text-[#F3F4EA] break-words overflow-hidden`}
                        >
                            {props.targetUserProfile.about}
                        </p>
                    </div>
                )
                : undefined}
            {props.targetUserProfile.website
                ? (
                    <div class={tw`flex items-start overflow-hidden w-full mt-4 group`}>
                        <HomeIcon
                            class={tw`w-6 h-6 mr-2`}
                            style={{
                                stroke: "#7A818C",
                                strokeWidth: "1.5",
                                fill: "none",
                            }}
                        />
                        <p
                            class={tw`flex-1 text-[${LinkColor}] group-hover:text-[#F3F4EA] break-words overflow-hidden`}
                        >
                            <a href={props.targetUserProfile.website} target="_blank">
                                {props.targetUserProfile.website}
                            </a>
                        </p>
                    </div>
                )
                : undefined}
        </div>
    );
}
