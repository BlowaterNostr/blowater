/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { InviteButton } from "./invite-button.tsx";
import { ConversationLists } from "./conversation-list.ts";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { PrivateKey } from "../lib/nostr-ts/key.ts";
import { tw } from "https://esm.sh/twind@0.16.16";
import { CenterClass } from "./components/tw.ts";

const ctx = InMemoryAccountContext.New(PrivateKey.Generate());
const conversationlist = new ConversationLists(ctx);

render(
    <div class={tw`${CenterClass} w-screen h-screen`}>
        <InviteButton groupChat={Array.from(conversationlist.getGroupChat())} />
    </div>,
    document.body,
);
