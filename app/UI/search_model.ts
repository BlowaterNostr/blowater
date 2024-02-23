import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { ProfileData } from "../features/profile.ts";

export type SearchUpdate = Cancel | SelectConversation | Start;
export type Start = {
    type: "StartSearch";
};
export type Cancel = {
    type: "CancelPopOver";
};

export type SelectConversation = {
    type: "SelectConversation";
    pubkey: PublicKey;
};

export type SearchModel = {
    isSearching: boolean;
};

export const SearchInitModel = (): SearchModel => {
    return {
        isSearching: false,
    };
};
