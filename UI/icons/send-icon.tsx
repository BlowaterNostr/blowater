/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";

export function SendIcon(props: {
    class?: string | h.JSX.SignalLike<string | undefined> | undefined;
    style?:
        | string
        | h.JSX.CSSProperties
        | h.JSX.SignalLike<string | h.JSX.CSSProperties>
        | undefined;
}) {
    return (
        <svg viewBox="0 0 24 24" class={props.class} style={props.style} xmlns="http://www.w3.org/2000/svg">
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
            </g>
            <g id="SVGRepo_iconCarrier">
                <path
                    d="M7.39999 6.32003L15.89 3.49003C19.7 2.22003 21.77 4.30003 20.51 8.11003L17.68 16.6C15.78 22.31 12.66 22.31 10.76 16.6L9.91999 14.08L7.39999 13.24C1.68999 11.34 1.68999 8.23003 7.39999 6.32003Z"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>{" "}
                <path
                    d="M10.11 13.6501L13.69 10.0601"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>
            </g>
        </svg>
    );
}
