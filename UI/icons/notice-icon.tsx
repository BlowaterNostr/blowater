/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function NoticeIcon(props: {
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
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
            <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
                <title>notice-active</title> <desc>Created with sketchtool.</desc>{" "}
                <g id="web-app" stroke="none" stroke-width="1" fill-rule="evenodd">
                    <g id="notice-active">
                        <path
                            d="M15.0846417,4.85258583 C15.3698859,3.78571001 16.3431867,3 17.5,3 C18.8807119,3 20,4.11928813 20,5.5 C20,6.82802369 18.9645064,7.9141949 17.6568748,7.99515796 C17.8790698,8.62208363 18,9.29691944 18,10 L18,16 L19,16 C19.5499992,16 20,16.4500008 20,17 C20,17.5499992 19.5499992,18 19,18 L15,18 L15,19 C15,20.6568542 13.6568542,22 12,22 C10.3431458,22 9,20.6568542 9,19 L9,18 L5,18 C4.44999981,18 4,17.5499992 4,17 C4,16.4500008 4.44999981,16 5,16 L6,16 L6,10 C6,7.02700371 8.16228666,4.55903653 11,4.08295844 L11,3 C11,2.44771525 11.4477153,2 12,2 C12.5522847,2 13,2.44771525 13,3 L13,4.08295844 C13.7514465,4.20902728 14.4555302,4.47477291 15.0846417,4.85258583 Z M12,20 C12.5522847,20 13,19.5522847 13,19 C13,18.7251922 13,18.3918589 13,18 L11,18 C11,18.470365 11,18.8036984 11,19 C11,19.5522847 11.4477153,20 12,20 Z M8,16 L16,16 L16,10 C16,7.790861 14.209139,6 12,6 C9.790861,6 8,7.790861 8,10 L8,16 Z"
                            id="Shape"
                        >
                        </path>
                    </g>
                </g>
            </g>
        </svg>
    );
}
