import { PublicKey } from "../../libs/nostr.ts/key.ts";

export type SearchUpdate = SelectConversation | Start;
export type Start = {
    type: "StartSearch";
};
export type SelectConversation = {
    type: "SelectConversation";
    pubkey: PublicKey;
};
