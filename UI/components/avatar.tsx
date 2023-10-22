/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";

export function Avatar(props: {
    picture: string | undefined;
    style?:
        | string
        | h.JSX.CSSProperties
        | h.JSX.SignalLike<string | h.JSX.CSSProperties>
        | undefined;
    class?: string | h.JSX.SignalLike<string | undefined> | undefined;
    onClick?: h.JSX.MouseEventHandler<HTMLImageElement>;
}) {
    return (
        <img
            onClick={props.onClick}
            style={props.style}
            class={[
                tw`rounded-full${props.onClick ? " cursor-pointer" : ""}`,
                props.class,
            ].join(" ")}
            src={props.picture ? props.picture : "logo-white.png"}
            alt="avatar"
            onError={(e) => {
                e.currentTarget.src = "logo-white.png";
                e.currentTarget.style.objectFit = "contain";
            }}
            onLoad={(e) => {
                if (e.currentTarget.src.endsWith("logo-white.png")) {
                    e.currentTarget.style.objectFit = "contain";
                } else {
                    e.currentTarget.style.objectFit = "cover";
                }
            }}
        />
    );
}
