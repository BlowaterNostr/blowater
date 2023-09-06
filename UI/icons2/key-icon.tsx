/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";

export function KeyIcon(props: {
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
                    d="M20 12H20.0133M20 20C24.4183 20 28 16.4183 28 12C28 7.58172 24.4183 4 20 4C15.5817 4 12 7.58172 12 12C12 12.3649 12.0244 12.7241 12.0717 13.076C12.1496 13.6549 12.1885 13.9443 12.1623 14.1274C12.135 14.3182 12.1003 14.421 12.0062 14.5892C11.916 14.7507 11.7569 14.9097 11.4388 15.2278L4.62484 22.0418C4.39424 22.2724 4.27894 22.3877 4.19648 22.5223C4.12337 22.6416 4.0695 22.7716 4.03684 22.9077C4 23.0611 4 23.2242 4 23.5503V25.8667C4 26.6134 4 26.9868 4.14532 27.272C4.27316 27.5229 4.47713 27.7268 4.72801 27.8547C5.01323 28 5.3866 28 6.13333 28H8.44968C8.7758 28 8.93886 28 9.09231 27.9632C9.22836 27.9305 9.35841 27.8766 9.47771 27.8035C9.61227 27.7211 9.72757 27.6058 9.95817 27.3752L16.7722 20.5612C17.0903 20.243 17.2493 20.084 17.4108 19.9937C17.579 19.8997 17.6818 19.865 17.8725 19.8377C18.0557 19.8115 18.3451 19.8504 18.9239 19.9282C19.2759 19.9756 19.6351 20 20 20Z"
                    stroke-width="2.66667"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </g>
        </svg>
    );
}
