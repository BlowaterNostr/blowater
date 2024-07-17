import { NavigationModel, NavTabID } from "./nav.tsx";
import { DM_Model } from "./dm.tsx";
import { Public_Model } from "./public-message-container.tsx";
import { App } from "./app.tsx";
import { default_blowater_relay } from "./relay-config.ts";
import { newURL } from "https://jsr.io/@blowater/nostr-sdk/0.0.6-rc1/_helper.ts";

export type Model = {
    app?: App; // app is only available after sign-in
    currentRelay: URL;
    dm: DM_Model;

    public: Public_Model;

    // UI
    navigationModel: NavigationModel;
};

export function initialModel(): Model {
    return {
        app: undefined,
        currentRelay: loadCurrentRelay(),
        dm: {
            currentConversation: undefined,
        },
        public: {
            relaySelectedChannel: new Map(),
        },
        navigationModel: {
            activeNav: awakenActiveNav(),
        },
    };
}

export function rememberCurrentRelay(relay: URL) {
    localStorage.setItem("currentRelay", relay.toString());
}

export function rememberActiveNav(nav: NavTabID) {
    localStorage.setItem("activeNav", nav);
}

function loadCurrentRelay() {
    const item = "currentRelay";
    const stored = localStorage.getItem(item);
    if (stored == null) {
        return default_blowater_relay;
    }
    const url = newURL(stored);
    if (url instanceof TypeError) {
        console.error(url);
        localStorage.removeItem(item);
        return default_blowater_relay;
    }
    return url;
}

function awakenActiveNav(): NavTabID {
    const activeNav = localStorage.getItem("activeNav");
    if (activeNav === null) return "Public";
    if (["Public", "DM", "Search", "Profile", "About", "Setting"].includes(activeNav)) {
        return activeNav as NavTabID;
    }
    return "Public";
}
