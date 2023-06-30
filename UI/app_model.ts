import { Database } from "../database.ts";

import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import {
    NostrEvent,
    NostrKind,
} from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";

import { DM_EditorModel, EditorModel, new_Social_EditorModel, Social_EditorModel } from "./editor.tsx";
import { NavigationModel } from "./nav.tsx";
import { SearchInitModel } from "./search_model.ts";
import { SignInModel } from "./signIn.tsx";
import { getProfileEvent, ProfileData } from "../features/profile.ts";
import { RightPanelModel } from "./message-panel.tsx";
import { DM_Container_Model } from "./dm.ts";

export type Model = {
    dm: DM_Container_Model;
    editors: Map<string, DM_EditorModel>;

    // profile
    myProfile: ProfileData | undefined;
    newProfileField: {
        key: string;
        value: string;
    };

    // social
    social: {
        editor: Social_EditorModel;
        replyEditors: Map<string, Social_EditorModel>;
        focusedContent: NostrEvent /* thread root event */ | PublicKey /* focused user profile */ | undefined;
    };

    // relay
    AddRelayButtonClickedError: string;
    AddRelayInput: string;

    // UI
    navigationModel: NavigationModel;
    rightPanelModel: RightPanelModel;

    // sign in
    signIn: SignInModel;
};

export function initialModel(): Model {
    const editors: Map<string, DM_EditorModel> = new Map();
    return {
        dm: {
            search: SearchInitModel(),
            selectedContactGroup: "Contacts",
            focusedContent: new Map(),
            hasNewMessages: new Set(),
            currentSelectedContact: undefined,
        },
        editors: editors,
        newProfileField: {
            key: "",
            value: "",
        },
        social: {
            editor: new_Social_EditorModel(),
            replyEditors: new Map<string, Social_EditorModel>(),
            focusedContent: undefined,
        },
        AddRelayButtonClickedError: "",
        AddRelayInput: "",
        navigationModel: {
            activeNav: "DM",
        },
        rightPanelModel: {
            show: false,
        },
        myProfile: undefined,
        signIn: {
            privateKey: "",
            state: "enterPrivateKey",
        },
    };
}
