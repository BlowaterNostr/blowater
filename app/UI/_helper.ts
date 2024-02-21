import { Component } from "https://esm.sh/preact@10.17.1";

export function isMobile() {
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function setState<P, S>(component: Component<P, S>, state: Partial<S>): Promise<void> {
    return new Promise((resolve) => {
        component.setState(state, () => {
            resolve();
        });
    });
}
