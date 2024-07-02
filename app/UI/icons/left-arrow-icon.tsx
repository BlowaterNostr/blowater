/** @jsx h */
import { h } from "preact";

export function LeftArrowIcon(props: {
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
            viewBox="0 0 1024 1024"
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g
                id="SVGRepo_tracerCarrier"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
            </g>
            <g id="SVGRepo_iconCarrier">
                <path d="M768 903.232l-50.432 56.768L256 512l461.568-448 50.432 56.768L364.928 512z">
                </path>
            </g>
        </svg>
    );
}
