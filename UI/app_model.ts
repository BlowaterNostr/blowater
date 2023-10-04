import { DM_EditorModel } from "./editor.tsx";
import { NavigationModel } from "./nav.tsx";
import { SearchInitModel, SearchModel } from "./search_model.ts";
import { ProfileData } from "../features/profile.ts";
import { RightPanelModel } from "./message-panel.tsx";
import { DM_Model } from "./dm.ts";
import { App } from "./app.tsx";
import { SignInModel } from "./signIn.tsx";

export type Model = {
    app: App | undefined; // app is only available after sign-in
    dm: DM_Model;
    search: SearchModel;
    editors: Map<string, DM_EditorModel>;

    // profile
    myProfile: ProfileData | undefined;
    newProfileField: {
        key: string;
        value: string;
    };

    // UI
    navigationModel: NavigationModel;
    rightPanelModel: RightPanelModel;

    // sign in
    signIn: SignInModel;
};

export function initialModel(): Model {
    const editors: Map<string, DM_EditorModel> = new Map();
    return {
        app: undefined,
        search: SearchInitModel(),
        dm: {
            focusedContent: new Map(),
            hasNewMessages: new Set(),
            currentSelectedContact: undefined,
            isGroupMessage: false,
        },
        // allUsersInfo: new Map(),
        editors: editors,
        newProfileField: {
            key: "",
            value: "",
        },
        navigationModel: {
            activeNav: "DM",
        },
        rightPanelModel: {
            show: false,
        },
        myProfile: undefined,
        signIn: {
            privateKey: "",
        },
    };
}
