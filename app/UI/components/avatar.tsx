/** @jsx h */
import { h } from "preact";

export function Avatar(props: {
    picture: string;
    style?:
        | string
        | h.JSX.CSSProperties
        | h.JSX.SignalLike<string | h.JSX.CSSProperties>
        | undefined;
    class?: string | h.JSX.SignalLike<string | undefined> | undefined;
    onClick?: h.JSX.MouseEventHandler<HTMLImageElement>;
}) {
    return (
        <div class={`sticky ${props.class}`} style={props.style}>
            {/* Container for positioning */}
            {
                /* <SantaHat class="absolute -top-1/3 left-1/4 w-full z-10 -scale-x-100 opacity-50" />
            <SantaHat class="absolute -top-1/3 left-1/4 w-full -z-10 -scale-x-100" /> */
            }
            <img
                onClick={props.onClick}
                class={`w-full h-full rounded-full aspect-square ${props.onClick ? "cursor-pointer" : ""}`}
                src={props.picture}
                alt="avatar"
                onError={(e) => {
                    e.currentTarget.src = "logo.webp";
                    e.currentTarget.style.objectFit = "contain";
                }}
                onLoad={(e) => {
                    if (e.currentTarget.src.endsWith("logo.webp")) {
                        e.currentTarget.style.objectFit = "contain";
                    } else {
                        e.currentTarget.style.objectFit = "cover";
                    }
                }}
            >
            </img>
        </div>
    );
}

export function RelayAvatar(props: {
    icon: string;
}) {
    return (
        <img
            class={`w-full h-full rounded-full`}
            src={props.icon}
            alt="avatar"
            onError={(e) => {
                e.currentTarget.src = "logo.webp";
                e.currentTarget.style.objectFit = "contain";
            }}
            onLoad={(e) => {
                if (e.currentTarget.src.endsWith("logo.webp")) {
                    e.currentTarget.style.objectFit = "contain";
                } else {
                    e.currentTarget.style.objectFit = "cover";
                }
            }}
        >
        </img>
    );
}
