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

export function* map<X, Y>(iter: Iterable<X>, mapper: (item: X) => Y) {
    for (const item of iter) {
        yield mapper(item);
    }
}

export function* filter<X>(iter: Iterable<X>, filterer: (item: X) => boolean) {
    for (const item of iter) {
        if (filterer(item)) {
            yield item;
        }
    }
}
