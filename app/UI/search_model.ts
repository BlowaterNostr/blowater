import { PublicKey } from "@blowater/nostr-sdk";

export type SearchUpdate = SelectConversation | StartSearch;
export type StartSearch = {
    type: "StartSearch";
};
export type SelectConversation = {
    type: "SelectConversation";
    pubkey: PublicKey;
};
