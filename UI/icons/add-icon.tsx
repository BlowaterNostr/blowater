/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function AddIcon(props: {
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
            viewBox="0 0 1920 1920"
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
                    d="M866.332 213v653.332H213v186.666h653.332v653.332h186.666v-653.332h653.332V866.332h-653.332V213z"
                    fill-rule="evenodd"
                >
                </path>
            </g>
        </svg>
    );
}
