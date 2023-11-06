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
            viewBox="0 0 25 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g>
                <path d="M13.5 5C13.5 4.44772 13.0523 4 12.5 4C11.9477 4 11.5 4.44772 11.5 5V11H5.5C4.94772 11 4.5 11.4477 4.5 12C4.5 12.5523 4.94772 13 5.5 13H11.5V19C11.5 19.5523 11.9477 20 12.5 20C13.0523 20 13.5 19.5523 13.5 19V13H19.5C20.0523 13 20.5 12.5523 20.5 12C20.5 11.4477 20.0523 11 19.5 11H13.5V5Z" />
            </g>
        </svg>
    );
}
