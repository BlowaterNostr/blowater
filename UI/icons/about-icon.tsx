/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function AboutIcon(props: {
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
            viewBox="0 0 52 52"
            data-name="Layer 1"
            id="Layer_1"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
                <rect
                    height="6"
                    rx="3"
                    transform="translate(52 27.52) rotate(180)"
                    width="6"
                    x="23"
                    y="10.76"
                >
                </rect>
                <path d="M27,41.24a2,2,0,0,1-2-2v-13H23a2,2,0,0,1,0-4h4a2,2,0,0,1,2,2v15A2,2,0,0,1,27,41.24Z">
                </path>
                <path d="M26,52A26,26,0,1,1,52,26,26,26,0,0,1,26,52ZM26,4A22,22,0,1,0,48,26,22,22,0,0,0,26,4Z">
                </path>
            </g>
        </svg>
    );
}
