/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";

export function UserIcon(props: {
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
            xmlns="http://www.w3.org/2000/svg"
        >
            <g id="user-03">
                <path
                    d="M4 26.6667C7.11438 23.3634 11.3427 21.3333 16 21.3333C20.6573 21.3333 24.8856 23.3634 28 26.6667M22 10C22 13.3137 19.3137 16 16 16C12.6863 16 10 13.3137 10 10C10 6.68629 12.6863 4 16 4C19.3137 4 22 6.68629 22 10Z"
                    stroke-width="2.67"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </g>
        </svg>
    );
}
