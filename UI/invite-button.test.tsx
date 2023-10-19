/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { InviteButton } from "./invite-button.tsx";
import { InMemoryAccountContext } from "../lib/nostr-ts/nostr.ts";
import { GroupMessageController } from "../features/gm.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { Database_Contextual_View } from "../database.ts";
import { testEventBus, testEventsAdapter } from "./_setup.test.ts";
import { tw } from "https://esm.sh/twind@0.16.16";
import { CenterClass } from "./components/tw.ts";
import { getTags } from "../nostr.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";

const database = await Database_Contextual_View.New(testEventsAdapter);
if (database instanceof Error) {
    fail(database.message);
}
const user_A = InMemoryAccountContext.Generate();
const user_B = InMemoryAccountContext.Generate();
const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
const gm_A_creation_event = await gm_A.encodeCreationToNostrEvent(gm_A.createGroupChat());
if (gm_A_creation_event instanceof Error) {
    fail(gm_A_creation_event.message);
}
gm_A.addEvent({
    ...gm_A_creation_event,
    parsedTags: getTags(gm_A_creation_event),
    publicKey: PublicKey.FromHex(gm_A_creation_event.pubkey) as PublicKey,
});
render(
    <div class={tw`${CenterClass}`}>
        <InviteButton
            userPublicKey={user_B.publicKey}
            groupChatController={gm_A}
            profileGetter={database}
            emit={testEventBus.emit}
        />
    </div>,
    document.body,
);
