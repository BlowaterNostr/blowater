/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function DeleteIcon(props: {
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
                <path
                    d="M10 12V17"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>{" "}
                <path
                    d="M14 12V17"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>{" "}
                <path
                    d="M4 7H20"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>{" "}
                <path
                    d="M6 10V18C6 19.6569 7.34315 21 9 21H15C16.6569 21 18 19.6569 18 18V10"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>{" "}
                <path
                    d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                </path>
            </g>
        </svg>
    );
}
