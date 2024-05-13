import { NavigationModel } from "./nav.tsx";
import { DM_Model } from "./dm.tsx";
import { Public_Model } from "./public-message-container.tsx";
import { App } from "./app.tsx";
import { default_blowater_relay } from "./relay-config.ts";
import { getRelayInformation, RelayInformation } from "./relay-detail.tsx";

export type Model = {
    app?: App; // app is only available after sign-in
    currentRelay: {
        url: string;
        relayInformation?: RelayInformation;
    };
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
        currentRelay: {
            url: default_blowater_relay,
        },
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
            activeNav: "Public",
        },
    };
}
