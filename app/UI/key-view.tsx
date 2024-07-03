/** @jsx h */
import { Fragment, h } from "preact";
import { PrivateKey, PublicKey } from "@blowater/nostr-sdk";
import { InputClass } from "./components/tw.ts";
import { PrimaryTextColor, TitleIconColor, WarnColor } from "./style/colors.ts";
import { KeyIcon } from "./icons/key-icon.tsx";
import { CopyButton } from "./components/copy-button.tsx";

export default function KeyView(props: {
    publicKey: PublicKey;
    privateKey: PrivateKey | undefined;
}) {
    const privateKey = props.privateKey;
    return (
        <Fragment>
            <p class={`text-[${PrimaryTextColor}] text-[1.3125rem] flex font-bold`}>
                <KeyIcon
                    class={`w-[2rem] h-[2rem] mr-[1rem]`}
                    style={{
                        stroke: TitleIconColor,
                        fill: "none",
                    }}
                />
                Key Pair
            </p>
            <p class={`mt-[1.75rem] text-[${PrimaryTextColor}]`}>Public Key</p>
            <div class={`relative`}>
                <input
                    value={props.publicKey.bech32()}
                    disabled
                    type="text"
                    class={`${InputClass} overflow-x-auto pr-[4rem]`}
                />
                <CopyButton
                    class={`absolute right-4 top-4`}
                    text={props.publicKey.bech32()}
                />
            </div>
            <p class={`mt-[1.5rem] text-[${PrimaryTextColor}]`}>Private Key</p>
            <div class={`relative`}>
                <input
                    value="●●●●●●"
                    disabled
                    type="password"
                    class={`${InputClass} overflow-x-auto pr-[4rem]`}
                />

                {privateKey
                    ? (
                        <CopyButton
                            class={`absolute right-4 top-4`}
                            text={privateKey.bech32}
                        />
                    )
                    : undefined}
            </div>
            {!privateKey
                ? (
                    <p class={`text-[${WarnColor}] text-[0.875rem] mt-[0.5rem]`}>
                        Blowater cannot view your private key because you logged in with an extension.
                    </p>
                )
                : undefined}
        </Fragment>
    );
}
