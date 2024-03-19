import { PublicKey } from "../../libs/nostr.ts/key.ts";

export type SearchUpdate = SelectConversation | StartSearch;
export type StartSearch = {
    type: "StartSearch";
};
export type SelectConversation = {
    type: "SelectConversation";
    pubkey: PublicKey;
};
