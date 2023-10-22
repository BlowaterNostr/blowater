/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function ChatIcon(props: {
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
            viewBox="0 0 24 24"
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
                <path d="M20,2H4A2,2,0,0,0,2,4V16a2,2,0,0,0,2,2H7v3a1,1,0,0,0,.57.9A.91.91,0,0,0,8,22a1,1,0,0,0,.62-.22L13.35,18H20a2,2,0,0,0,2-2V4A2,2,0,0,0,20,2ZM8,11a1,1,0,1,1,1-1A1,1,0,0,1,8,11Zm4,0a1,1,0,1,1,1-1A1,1,0,0,1,12,11Zm4,0a1,1,0,1,1,1-1A1,1,0,0,1,16,11Z">
                </path>
            </g>
        </svg>
    );
}
