import { NavigationModel, NavTabID } from "./nav.tsx";
import { DM_Model } from "./dm.tsx";
import { Public_Model } from "./public-message-container.tsx";
import { App } from "./app.tsx";
import { default_blowater_relay } from "./relay-config.ts";

export type Model = {
    app?: App; // app is only available after sign-in
    currentRelay: string;
    dm: DM_Model;

    public: Public_Model;

    // profile
    newProfileField: {
        key: string;
        value: string;
    };

    // UI
    navigationModel: NavigationModel;
};

export function initialModel(): Model {
    return {
        app: undefined,
        currentRelay: awakenCurrentRelay(),
        dm: {
            currentConversation: undefined,
        },
        public: {
            relaySelectedChannel: new Map(),
        },
        newProfileField: {
            key: "",
            value: "",
        },
        navigationModel: {
            activeNav: awakenActiveNav(),
        },
    };
}

export function rememberCurrentRelay(relay: string) {
    localStorage.setItem("currentRelay", relay);
}

export function rememberActiveNav(nav: NavTabID) {
    localStorage.setItem("activeNav", nav);
}

function awakenCurrentRelay() {
    return localStorage.getItem("currentRelay") || default_blowater_relay;
}

function awakenActiveNav(): NavTabID {
    const activeNav = localStorage.getItem("activeNav");
    if (activeNav === null) return "Public";
    if (["Public", "DM", "Search", "Profile", "About", "Setting"].includes(activeNav)) {
        return activeNav as NavTabID;
    }
    return "Public";
}
