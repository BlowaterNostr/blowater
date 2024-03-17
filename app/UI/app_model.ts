import { NavigationModel } from "./nav.tsx";
import { ProfileData } from "../features/profile.ts";

import { DM_Model } from "./dm.tsx";
import { Social_Model } from "./channel-container.tsx";
import { App } from "./app.tsx";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { default_blowater_relay } from "./relay-config.ts";

export type Model = {
    app?: App; // app is only available after sign-in
    currentRelay: string;
    dm: DM_Model;

    social: Social_Model;

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
        currentRelay: default_blowater_relay,
        dm: {
            currentConversation: undefined,
        },
        social: {
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
