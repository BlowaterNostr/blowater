/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { PrivateKey, PublicKey } from "../lib/nostr.ts/key.ts";
import { CenterClass, IconButtonClass, InputClass, NoOutlineClass } from "./components/tw.ts";
import { DividerBackgroundColor, PrimaryTextColor, TitleIconColor, WarnColor } from "./style/colors.ts";
import { KeyIcon } from "./icons2/key-icon.tsx";
import { CopyIcon } from "./icons2/copy-icon.tsx";

export default function KeyView(props: {
    publicKey: PublicKey;
    privateKey: PrivateKey | undefined;
}) {
    const privateKey = props.privateKey;
    return (
        <Fragment>
            <p class={tw`text-[${PrimaryTextColor}] text-[1.3125rem] flex`}>
                <KeyIcon
                    class={tw`w-[2rem] h-[2rem] mr-[1rem]`}
                    style={{
                        stroke: TitleIconColor,
                        fill: "none",
                    }}
                />
                Key Pair
            </p>
            <p class={tw`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Public Key</p>
            <div class={tw`relative`}>
                <input
                    value={props.publicKey.bech32()}
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />
                <button
                    class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                    onClick={async () => {
                        await navigator.clipboard.writeText(props.publicKey.bech32());
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
            <p class={tw`mt-[1.5rem] text-[${PrimaryTextColor}]`}>Private Key</p>
            <div class={tw`relative`}>
                <input
                    value="●●●●●●"
                    disabled
                    type="text"
                    class={tw`${InputClass} truncate pr-[4rem]`}
                />

                {privateKey
                    ? (
                        <button
                            class={tw`absolute w-[2rem] h-[2rem] rounded-lg top-[0.5rem] right-[1rem] hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`}
                            onClick={async () => {
                                await navigator.clipboard.writeText(privateKey.bech32);
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
                    )
                    : undefined}
            </div>
            {!privateKey
                ? (
                    <p class={tw`text-[${WarnColor}] text-[0.875rem] mt-[0.5rem]`}>
                        Blowater cannot view your private key because you logged in with an extension.
                    </p>
                )
                : undefined}
        </Fragment>
    );
}
