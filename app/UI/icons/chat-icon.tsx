/** @jsx h */
import { h } from "preact";

export function ChatIcon(props: {
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
            viewBox="0 0 28 28"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M8.66666 10.6667H14M8.66666 15.3333H18M14 26C20.6274 26 26 20.6274 26 14C26 7.37258 20.6274 2 14 2C7.37258 2 2 7.37258 2 14C2 15.5962 2.31165 17.1196 2.87742 18.5127C2.9857 18.7793 3.03984 18.9126 3.06399 19.0204C3.08762 19.1258 3.09626 19.2038 3.09628 19.3118C3.09629 19.4223 3.07624 19.5425 3.03614 19.7831L2.2455 24.527C2.16271 25.0237 2.12131 25.2721 2.19835 25.4517C2.26577 25.6089 2.39104 25.7342 2.54825 25.8016C2.72786 25.8787 2.97624 25.8373 3.47301 25.7545L8.21686 24.9638C8.45745 24.9237 8.57774 24.9037 8.68817 24.9037C8.7962 24.9037 8.87421 24.9124 8.97962 24.936C9.08739 24.9602 9.2207 25.0143 9.48732 25.1226C10.8804 25.6883 12.4038 26 14 26Z"
                stroke-width="2.66667"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
}
