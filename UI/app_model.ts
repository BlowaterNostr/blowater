import { PublicKey } from "../lib/nostr-ts/key.ts";
import { NostrEvent, NostrFilters } from "../lib/nostr-ts/nostr.ts";

import { DM_EditorModel, new_Social_EditorModel, Social_EditorModel } from "./editor.tsx";
import { NavigationModel } from "./nav.tsx";
import { SearchInitModel } from "./search_model.ts";
import { ProfileData } from "../features/profile.ts";
import { RightPanelModel } from "./message-panel.tsx";
import { DM_Container_Model } from "./dm.ts";
import { App } from "./app.tsx";
import { MessageThread } from "./dm.tsx";
import { SignInModel } from "./signIn.tsx";

export type Model = {
    app: App | undefined; // app is only available after sign-in
    dm: DM_Container_Model;
    editors: Map<string, DM_EditorModel>;

    // profile
    myProfile: ProfileData | undefined;
    newProfileField: {
        key: string;
        value: string;
    };
    // allUsersInfo: Map<string, UserInfo>;

    // social
    social: {
        threads: MessageThread[];
        editor: Social_EditorModel;
        replyEditors: Map<string, Social_EditorModel>;
        focusedContent: NostrEvent /* thread root event */ | PublicKey /* focused user profile */ | undefined;
        filter: {
            content: string;
            pubkeys: string[];
            author: Set<string>;
            adding_author: string;
        };
        activeSyncingFilter: NostrFilters | undefined;
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
        dm: {
            search: SearchInitModel(),
            selectedContactGroup: "Contacts",
            focusedContent: new Map(),
            hasNewMessages: new Set(),
            currentSelectedContact: undefined,
        },
        // allUsersInfo: new Map(),
        editors: editors,
        newProfileField: {
            key: "",
            value: "",
        },
        social: {
            threads: [],
            editor: new_Social_EditorModel(),
            replyEditors: new Map<string, Social_EditorModel>(),
            focusedContent: undefined,
            filter: {
                content: "",
                pubkeys: [],
                author: new Set(),
                adding_author: "",
            },
            activeSyncingFilter: undefined,
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
