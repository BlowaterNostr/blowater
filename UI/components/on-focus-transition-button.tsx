/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DividerBackgroundColor, PrimaryTextColor, SuccessColor } from "../style/colors.ts";
import { CopyIcon } from "../icons/copy-icon.tsx";
import { CenterClass, NoOutlineClass } from "./tw.ts";
import { CheckIcon } from "../icons/check-icon.tsx";

export function OnFocusTransitionButton(props: {
    class?: string | h.JSX.SignalLike<string | undefined> | undefined;
    onFocus?: h.JSX.FocusEventHandler<HTMLButtonElement>;
}) {
    return (
        <button
            class={[
                tw`w-6 h-6 rounded-lg hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass} group`,
                props.class,
            ].join(" ")}
            onFocus={props.onFocus}
        >
            <CheckIcon
                class={tw`w-4 h-4 hidden group-focus:block`}
                style={{
                    fill: "none",
                    stroke: SuccessColor,
                }}
            />
            <CopyIcon
                class={tw`w-4 h-4 group-focus:hidden`}
                style={{
                    fill: "none",
                    stroke: PrimaryTextColor,
                }}
            />
        </button>
    );
}
