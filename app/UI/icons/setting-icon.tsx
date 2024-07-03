/** @jsx h */
import { h } from "preact";

export function SettingIcon(props: {
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
                <g>
                    <path
                        d="M12.5269 25.8281L13.3061 27.5807C13.5378 28.1024 13.9158 28.5457 14.3944 28.8568C14.873 29.1679 15.4316 29.3334 16.0024 29.3333C16.5733 29.3334 17.1318 29.1679 17.6104 28.8568C18.089 28.5457 18.4671 28.1024 18.6987 27.5807L19.478 25.8281C19.7554 25.2062 20.222 24.6878 20.8113 24.3467C21.4044 24.0046 22.0904 23.8588 22.7713 23.9304L24.678 24.1333C25.2455 24.1933 25.8183 24.0874 26.3269 23.8284C26.8355 23.5694 27.258 23.1684 27.5432 22.6741C27.8287 22.18 27.9648 21.6137 27.9348 21.0438C27.9048 20.474 27.7101 19.9251 27.3743 19.4637L26.2454 17.9126C25.8434 17.3562 25.6286 16.6864 25.6321 16C25.6319 15.3154 25.8487 14.6485 26.2513 14.0948L27.3802 12.5437C27.716 12.0823 27.9108 11.5334 27.9407 10.9636C27.9707 10.3937 27.8347 9.82737 27.5491 9.33332C27.2639 8.83897 26.8414 8.43797 26.3328 8.17896C25.8243 7.91994 25.2515 7.81403 24.6839 7.87406L22.7772 8.07702C22.0964 8.14853 21.4103 8.00282 20.8172 7.66073C20.2268 7.31766 19.76 6.79647 19.4839 6.17184L18.6987 4.41925C18.4671 3.89755 18.089 3.45428 17.6104 3.14319C17.1318 2.8321 16.5733 2.66656 16.0024 2.66666C15.4316 2.66656 14.873 2.8321 14.3944 3.14319C13.9158 3.45428 13.5378 3.89755 13.3061 4.41925L12.5269 6.17184C12.2508 6.79647 11.784 7.31766 11.1935 7.66073C10.6005 8.00282 9.91444 8.14853 9.23355 8.07702L7.32096 7.87406C6.7534 7.81403 6.18061 7.91994 5.67205 8.17896C5.16348 8.43797 4.74098 8.83897 4.45577 9.33332C4.1702 9.82737 4.03415 10.3937 4.06413 10.9636C4.09411 11.5334 4.28883 12.0823 4.62466 12.5437L5.75355 14.0948C6.15614 14.6485 6.37294 15.3154 6.37281 16C6.37294 16.6845 6.15614 17.3515 5.75355 17.9052L4.62466 19.4563C4.28883 19.9176 4.09411 20.4666 4.06413 21.0364C4.03415 21.6063 4.1702 22.1726 4.45577 22.6666C4.74126 23.1607 5.16381 23.5615 5.6723 23.8205C6.1808 24.0795 6.75344 24.1856 7.32096 24.1259L9.22762 23.9229C9.90852 23.8514 10.5946 23.9972 11.1876 24.3392C11.7803 24.6813 12.2492 25.2026 12.5269 25.8281Z"
                        stroke-width="2.67"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                    <path
                        d="M16.0001 20C18.2092 20 20.0001 18.2091 20.0001 16C20.0001 13.7908 18.2092 12 16.0001 12C13.7909 12 12.0001 13.7908 12.0001 16C12.0001 18.2091 13.7909 20 16.0001 20Z"
                        stroke-width="2.67"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </g>
            </g>
        </svg>
    );
}
