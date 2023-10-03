import { PublicKey } from "../lib/nostr-ts/key.ts";
import { ProfileData } from "../features/profile.ts";

export type SearchUpdate = Cancel | SearchPublicKey | SelectConversation | Start;
export type Start = {
    type: "StartSearch";
};
export type Cancel = {
    type: "CancelPopOver";
};
export type SearchPublicKey = {
    type: "Search";
    text: string;
};

export type SelectConversation = {
    type: "SelectConversation";
    pubkey: PublicKey;
};

export type SearchModel = {
    isSearching: boolean;
    searchResults: {
        pubkey: PublicKey;
        profile: ProfileData | undefined;
    }[];
};

export const SearchInitModel = (): SearchModel => {
    return {
        searchResults: [],
        isSearching: false,
    };
};
