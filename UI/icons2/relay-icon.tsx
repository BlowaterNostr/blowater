/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function RelayIcon(props: {
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
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g id="server-05">
                <path
                    d="M25.3333 11.9998C25.3333 17.1545 21.1547 21.3332 16 21.3332M25.3333 11.9998C25.3333 6.84518 21.1547 2.6665 16 2.6665M25.3333 11.9998H6.66667M16 21.3332C10.8453 21.3332 6.66667 17.1545 6.66667 11.9998M16 21.3332C18.3345 18.7774 19.6624 15.4606 19.7345 11.9998C19.6624 8.53907 18.3345 5.2223 16 2.6665M16 21.3332C13.6655 18.7774 12.34 15.4606 12.2679 11.9998C12.34 8.53907 13.6655 5.2223 16 2.6665M16 21.3332V23.9998M6.66667 11.9998C6.66667 6.84518 10.8453 2.6665 16 2.6665M18.6667 26.6665C18.6667 28.1393 17.4728 29.3332 16 29.3332C14.5272 29.3332 13.3333 28.1393 13.3333 26.6665M18.6667 26.6665C18.6667 25.1937 17.4728 23.9998 16 23.9998M18.6667 26.6665H28M13.3333 26.6665C13.3333 25.1937 14.5272 23.9998 16 23.9998M13.3333 26.6665H4"
                    stroke-width="2.66667"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </g>
        </svg>
    );
}
