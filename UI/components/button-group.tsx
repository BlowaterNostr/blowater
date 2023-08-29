/** @jsx h */
import { ComponentChildren, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DividerBackgroundColor, HoverButtonBackgroudColor } from "../style/colors.ts";
import { NoOutlineClass } from "./tw.ts";

export function ButtonGroup(props: {
    children: ComponentChildren;
    class?: string | h.JSX.SignalLike<string | undefined>;
}) {
    return (
        <div
            class={[
                tw`flex w-min bg-[${DividerBackgroundColor}] rounded children:hover:bg-[${HoverButtonBackgroudColor}] children:${NoOutlineClass} children:px-2 children:py-1 firstChild:rounded-l lastChild:rounded-r`,
                props.class,
            ].join(" ")}
        >
            {props.children}
        </div>
    );
}
