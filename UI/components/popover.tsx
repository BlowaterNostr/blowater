/** @jsx h */
import { ComponentChildren, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { SecondaryBackgroundColor } from "../style/colors.ts";

export function Popover(props: {
    escapeClose?: boolean;
    blankClickClose?: boolean;
    close: () => void;
    children: ComponentChildren;
}) {
    return (
        <div
            class={tw`fixed inset-0 z-20`}
            onKeyDown={(e) => {
                if (props.escapeClose && e.code === "Escape") {
                    props.close();
                }
            }}
        >
            <div
                class={tw`fixed inset-0 z-[-1] backdrop-filter backdrop-blur`}
                onClick={props.blankClickClose
                    ? () => {
                        props.close();
                    }
                    : undefined}
            >
            </div>
            <div
                class={tw`h-[80%] absolute top-[20%] overflow-auto bg-[${SecondaryBackgroundColor}] w-full`}
                style={{
                    boxShadow: "rgba(0, 0, 0, 0.35) 0px 5px 15px",
                }}
            >
                {props.children}
            </div>
        </div>
    );
}
