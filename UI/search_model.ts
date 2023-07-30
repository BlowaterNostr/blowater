import { PublicKey } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/key.ts";
import { ProfileData } from "../features/profile.ts";

export type SearchUpdate = Cancel | SearchPublicKey | SelectProfile | Start;
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

export type SelectProfile = {
    type: "SelectProfile";
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
