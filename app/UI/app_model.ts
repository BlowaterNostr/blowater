import { NavigationModel } from "./nav.tsx";
import { ProfileData } from "../features/profile.ts";
import { EditorModel } from "./editor.tsx";
import { DM_Model } from "./dm.tsx";
import { Social_Model } from "./channel-container.tsx";
import { App } from "./app.tsx";

export type Model = {
    app: App | undefined; // app is only available after sign-in
    dm: DM_Model;
    dmEditors: Map<string, EditorModel>;

    social: Social_Model;

    // profile
    myProfile: ProfileData | undefined;
    newProfileField: {
        key: string;
        value: string;
    };

    // UI
    navigationModel: NavigationModel;
};

export function initialModel(): Model {
    const editors: Map<string, EditorModel> = new Map();
    return {
        app: undefined,
        dm: {
            focusedContent: new Map(),
            currentEditor: undefined,
        },
        dmEditors: editors,
        social: {
            relaySelectedChannel: new Map(),
            currentChannel: undefined,
        },
        newProfileField: {
            key: "",
            value: "",
        },
        navigationModel: {
            activeNav: "DM",
        },
        myProfile: undefined,
    };
}
