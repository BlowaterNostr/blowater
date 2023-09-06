/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function BackIcon(props: {
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
                <path d="M224 480h640a32 32 0 1 1 0 64H224a32 32 0 0 1 0-64z">
                </path>
                <path d="m237.248 512 265.408 265.344a32 32 0 0 1-45.312 45.312l-288-288a32 32 0 0 1 0-45.312l288-288a32 32 0 1 1 45.312 45.312L237.248 512z">
                </path>
            </g>
        </svg>
    );
}
