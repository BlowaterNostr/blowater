/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function SendIcon(props: {
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
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g>
                <path
                    d="M8.74958 11.2501L17.4996 2.50005M8.8559 11.5234L11.046 17.1551C11.2389 17.6512 11.3354 17.8993 11.4744 17.9717C11.5949 18.0345 11.7384 18.0346 11.859 17.9719C11.9981 17.8997 12.0949 17.6517 12.2884 17.1558L17.7803 3.08272C17.955 2.63507 18.0424 2.41124 17.9946 2.26822C17.9531 2.14401 17.8556 2.04654 17.7314 2.00504C17.5884 1.95726 17.3646 2.04461 16.9169 2.2193L2.84379 7.71125C2.3479 7.90477 2.09995 8.00153 2.02769 8.14062C1.96505 8.26119 1.96514 8.40474 2.02792 8.52523C2.10034 8.66424 2.3484 8.7607 2.84452 8.95364L8.47619 11.1437C8.5769 11.1829 8.62725 11.2025 8.66965 11.2327C8.70724 11.2595 8.7401 11.2924 8.76691 11.33C8.79715 11.3724 8.81673 11.4227 8.8559 11.5234Z"
                    stroke-width="1.66667"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </g>
        </svg>
    );
}
