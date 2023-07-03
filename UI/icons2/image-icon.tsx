/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";

export function ImageIcon(props: {
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
            <g>
                <path
                    d="M7.99946 26.6672L19.8249 14.8418C20.3529 14.3138 20.6169 14.0497 20.9213 13.9508C21.1891 13.8638 21.4776 13.8638 21.7454 13.9508C22.0498 14.0497 22.3138 14.3138 22.8418 14.8418L28.5403 20.5403M14 11.3333C14 12.806 12.8061 14 11.3334 14C9.86059 14 8.66668 12.806 8.66668 11.3333C8.66668 9.86053 9.86059 8.66662 11.3334 8.66662C12.8061 8.66662 14 9.86053 14 11.3333ZM29.3333 16C29.3333 23.3637 23.3638 29.3333 16 29.3333C8.63622 29.3333 2.66669 23.3637 2.66669 16C2.66669 8.63616 8.63622 2.66663 16 2.66663C23.3638 2.66663 29.3333 8.63616 29.3333 16Z"
                    stroke-width="2.66667"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </g>
        </svg>
    );
}
