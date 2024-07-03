/** @jsx h */
import { h } from "preact";

export function MembersIcon(props: {
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
                d="M14.6562 19.74C15.9964 18.8477 17.014 17.5478 17.5583 16.0326C18.1027 14.5173 18.1449 12.867 17.6788 11.3259C17.2127 9.78471 16.2631 8.43445 14.9702 7.47478C13.6774 6.5151 12.11 5.99695 10.4999 5.99695C8.88984 5.99695 7.32249 6.5151 6.02965 7.47478C4.73682 8.43445 3.78714 9.78471 3.32105 11.3259C2.85497 12.867 2.89722 14.5173 3.44156 16.0326C3.9859 17.5478 5.00344 18.8477 6.34369 19.74C3.9193 20.6335 1.84882 22.287 0.44119 24.4537C0.36721 24.5637 0.315823 24.6873 0.290017 24.8172C0.26421 24.9472 0.264499 25.0811 0.290866 25.2109C0.317234 25.3408 0.369154 25.4641 0.443608 25.5738C0.518063 25.6834 0.613566 25.7772 0.724568 25.8496C0.83557 25.922 0.959855 25.9716 1.0902 25.9955C1.22054 26.0195 1.35435 26.0173 1.48383 25.989C1.61332 25.9608 1.73591 25.9071 1.84446 25.8311C1.95302 25.7551 2.04539 25.6583 2.11619 25.5462C3.02418 24.1497 4.26664 23.0021 5.73074 22.2077C7.19484 21.4133 8.8342 20.9972 10.4999 20.9972C12.1657 20.9972 13.805 21.4133 15.2691 22.2077C16.7332 23.0021 17.9757 24.1497 18.8837 25.5462C19.0304 25.7642 19.2569 25.9157 19.5144 25.968C19.7719 26.0203 20.0396 25.9691 20.2597 25.8256C20.4797 25.6821 20.6345 25.4577 20.6904 25.201C20.7464 24.9443 20.6991 24.6758 20.5587 24.4537C19.1511 22.287 17.0806 20.6335 14.6562 19.74ZM4.99994 13.5C4.99994 12.4122 5.32251 11.3488 5.92686 10.4444C6.5312 9.53988 7.39019 8.83494 8.39518 8.41865C9.40017 8.00237 10.506 7.89345 11.5729 8.10567C12.6398 8.31789 13.6198 8.84171 14.389 9.6109C15.1582 10.3801 15.682 11.3601 15.8943 12.427C16.1065 13.4939 15.9976 14.5998 15.5813 15.6048C15.165 16.6097 14.46 17.4687 13.5556 18.0731C12.6511 18.6774 11.5877 19 10.4999 19C9.04176 18.9983 7.64377 18.4183 6.61268 17.3873C5.58159 16.3562 5.00159 14.9582 4.99994 13.5ZM31.2674 25.8375C31.0453 25.9823 30.7747 26.033 30.5153 25.9784C30.2558 25.9238 30.0286 25.7683 29.8837 25.5462C28.9768 24.1489 27.7345 23.0008 26.2701 22.2067C24.8057 21.4126 23.1658 20.9978 21.4999 21C21.2347 21 20.9804 20.8946 20.7928 20.7071C20.6053 20.5196 20.4999 20.2652 20.4999 20C20.4999 19.7348 20.6053 19.4804 20.7928 19.2929C20.9804 19.1053 21.2347 19 21.4999 19C22.3099 18.9992 23.1097 18.8196 23.8422 18.4739C24.5747 18.1282 25.2218 17.625 25.7372 17.0002C26.2527 16.3754 26.6238 15.6445 26.824 14.8597C27.0243 14.0749 27.0487 13.2555 26.8956 12.4602C26.7424 11.6648 26.4155 10.9131 25.9382 10.2587C25.4609 9.60437 24.8449 9.0635 24.1343 8.67478C23.4237 8.28606 22.6361 8.05909 21.8276 8.01007C21.0191 7.96106 20.2098 8.09121 19.4574 8.39124C19.3348 8.44427 19.2027 8.47217 19.0691 8.4733C18.9355 8.47443 18.803 8.44876 18.6794 8.39782C18.5559 8.34687 18.4438 8.27168 18.3498 8.17668C18.2558 8.08168 18.1818 7.96881 18.1322 7.84473C18.0825 7.72065 18.0583 7.58788 18.0608 7.45426C18.0634 7.32065 18.0927 7.1889 18.147 7.06681C18.2013 6.94471 18.2796 6.83474 18.3771 6.7434C18.4747 6.65205 18.5895 6.58119 18.7149 6.53499C20.4368 5.84831 22.3519 5.82359 24.0909 6.46562C25.8298 7.10766 27.2694 8.37094 28.1319 10.0118C28.9944 11.6526 29.2187 13.5547 28.7616 15.3511C28.3044 17.1476 27.1981 18.7111 25.6562 19.74C28.0806 20.6335 30.1511 22.287 31.5587 24.4537C31.7035 24.6759 31.7542 24.9464 31.6996 25.2059C31.645 25.4654 31.4895 25.6926 31.2674 25.8375Z"
                fill="currentColor"
            />
        </svg>
    );
}
