/** @jsx h */
import { ComponentChildren, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DividerBackgroundColor, HoverButtonBackgroudColor } from "../style/colors.ts";

export function ButtonGroup(props: {
    children: ComponentChildren;
    class?: string;
    style?: string | h.JSX.CSSProperties | h.JSX.SignalLike<string | h.JSX.CSSProperties>;
}) {
    return (
        <div
            style={props.style}
            class={[
                tw`flex w-min bg-[${DividerBackgroundColor}]
                rounded
                children:hover:bg-[${HoverButtonBackgroudColor}]
                children:focus:outline-none
                focus-visible:outline-none
                children:px-2 children:py-1
                firstChild:rounded-l
                lastChild:rounded-r`,
                props.class,
            ].join(" ")}
        >
            {props.children}
        </div>
    );
}
