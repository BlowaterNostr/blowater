/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function RemoveIcon(props: {
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
            viewBox="0 0 22 22"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g>
                <path
                    d="M13.6669 8.33334L8.33355 13.6667M8.33355 8.33334L13.6669 13.6667M19.8891 11C19.8891 15.9092 15.9094 19.8889 11.0002 19.8889C6.09102 19.8889 2.11133 15.9092 2.11133 11C2.11133 6.09081 6.09102 2.11111 11.0002 2.11111C15.9094 2.11111 19.8891 6.09081 19.8891 11Z"
                    stroke-width="1.77778"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </g>
        </svg>
    );
}
