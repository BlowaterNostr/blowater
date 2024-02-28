import { PublicKey } from "../../libs/nostr.ts/key.ts";

export type SearchUpdate = SelectChannel | SelectConversation | Start;
export type Start = {
    type: "StartSearch";
};
export type SelectConversation = {
    type: "SelectConversation";
    pubkey: PublicKey;
};
export type SelectChannel = {
    type: "SelectChannel";
    channel: string;
};
