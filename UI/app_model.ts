import { NavigationModel } from "./nav.tsx";
import { SearchInitModel, SearchModel } from "./search_model.ts";
import { ProfileData } from "../features/profile.ts";
import { RightPanelModel } from "./message-panel.tsx";
import { App } from "./app.tsx";
import { SignInModel } from "./signIn.tsx";
import { EditorModel } from "./editor.tsx";
import { DM_Model } from "./dm.tsx";

export type Model = {
    app: App | undefined; // app is only available after sign-in
    dm: DM_Model;
    search: SearchModel;

    dmEditors: Map<string, EditorModel>;
    gmEditors: Map<string, EditorModel>;

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
    const editors: Map<string, EditorModel> = new Map();
    return {
        app: undefined,
        search: SearchInitModel(),
        dm: {
            focusedContent: new Map(),
            currentEditor: undefined,
            isGroupMessage: false,
        },
        dmEditors: editors,
        gmEditors: new Map(),
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
