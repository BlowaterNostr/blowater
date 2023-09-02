import { PublicKey } from "../lib/nostr-ts/key.ts";
import { ProfileData } from "../features/profile.ts";

export type SearchUpdate = Cancel | SearchPublicKey | SelectProfile | Start;
export type Start = {
    type: "StartSearch";
};
export type Cancel = {
    type: "CancelSearch";
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
    searchResults: {
        pubkey: PublicKey;
        profile: ProfileData | undefined;
    }[];
};

export const SearchInitModel = (): SearchModel => {
    return {
        searchResults: [],
    };
};
