/** @jsx h */
import { h } from "preact";

export function GlobeIcon(props: {
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
            <path
                d="M16 3C13.4288 3 10.9154 3.76244 8.77759 5.1909C6.63975 6.61935 4.9735 8.64968 3.98956 11.0251C3.00563 13.4006 2.74818 16.0144 3.24979 18.5362C3.7514 21.0579 4.98953 23.3743 6.80761 25.1924C8.62569 27.0105 10.9421 28.2486 13.4638 28.7502C15.9856 29.2518 18.5994 28.9944 20.9749 28.0104C23.3503 27.0265 25.3806 25.3603 26.8091 23.2224C28.2376 21.0846 29 18.5712 29 16C28.996 12.5534 27.6251 9.24911 25.188 6.812C22.7509 4.37488 19.4466 3.00397 16 3ZM27 16C27.0009 17.0145 26.8608 18.0241 26.5837 19H21.77C22.0767 17.0118 22.0767 14.9882 21.77 13H26.5837C26.8608 13.9759 27.0009 14.9855 27 16ZM12.75 21H19.25C18.6096 23.0982 17.498 25.0223 16 26.625C14.5026 25.0218 13.391 23.098 12.75 21ZM12.2625 19C11.9192 17.0147 11.9192 14.9853 12.2625 13H19.7475C20.0908 14.9853 20.0908 17.0147 19.7475 19H12.2625ZM5 16C4.99913 14.9855 5.13922 13.9759 5.41625 13H10.23C9.92333 14.9882 9.92333 17.0118 10.23 19H5.41625C5.13922 18.0241 4.99913 17.0145 5 16ZM19.25 11H12.75C13.3904 8.90176 14.502 6.97773 16 5.375C17.4974 6.97815 18.609 8.90204 19.25 11ZM25.7912 11H21.3387C20.7776 8.94113 19.8318 7.00709 18.5512 5.3C20.0984 5.67166 21.5469 6.37347 22.7974 7.35732C24.0479 8.34117 25.0709 9.58379 25.7962 11H25.7912ZM13.4487 5.3C12.1682 7.00709 11.2224 8.94113 10.6612 11H6.20375C6.92909 9.58379 7.95208 8.34117 9.20261 7.35732C10.4531 6.37347 11.9016 5.67166 13.4487 5.3ZM6.20375 21H10.6612C11.2224 23.0589 12.1682 24.9929 13.4487 26.7C11.9016 26.3283 10.4531 25.6265 9.20261 24.6427C7.95208 23.6588 6.92909 22.4162 6.20375 21ZM18.5512 26.7C19.8318 24.9929 20.7776 23.0589 21.3387 21H25.7962C25.0709 22.4162 24.0479 23.6588 22.7974 24.6427C21.5469 25.6265 20.0984 26.3283 18.5512 26.7Z"
                fill="currentColor"
            />
        </svg>
    );
}