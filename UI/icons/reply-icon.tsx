/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function ReplyIcon(props: {
    class?: string | h.JSX.SignalLike<string | undefined> | undefined;
    style?:
        | string
        | h.JSX.CSSProperties
        | h.JSX.SignalLike<string | h.JSX.CSSProperties>
        | undefined;
}) {
    return (
        <svg
            class={props.class}
            style={props.style}
            viewBox="0 0 32 32"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
                <title>reply</title>{" "}
                <path d="M3.488 15.136q0 0.96 0.8 1.472l10.72 7.136q0.416 0.288 0.896 0.32t0.928-0.224 0.704-0.672 0.256-0.896v-3.584q3.456 0 6.208 1.984t3.872 5.152q0.64-1.792 0.64-3.552 0-2.912-1.44-5.376t-3.904-3.904-5.376-1.44v-3.584q0-0.48-0.256-0.896t-0.704-0.672-0.928-0.224-0.896 0.32l-10.72 7.136q-0.8 0.512-0.8 1.504z">
                </path>
            </g>
        </svg>
    );
}
