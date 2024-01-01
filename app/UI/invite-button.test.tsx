/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { InviteButton } from "./invite-button.tsx";
import { InMemoryAccountContext } from "../../libs/nostr.ts/nostr.ts";
import { GroupMessageController } from "../features/gm.ts";
import { fail } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { test_db_view, testEventBus } from "./_setup.test.ts";
import { CenterClass } from "./components/tw.ts";
import { getTags } from "../nostr.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";

const database = await test_db_view();

const user_A = InMemoryAccountContext.Generate();
const user_B = InMemoryAccountContext.Generate();
const gm_A = new GroupMessageController(user_A, { add: (_) => {} }, { add: (_) => {} });
const gm_A_creation = gm_A.createGroupChat();
const gm_A_creation_event = await gm_A.encodeCreationToNostrEvent(gm_A_creation);
if (gm_A_creation_event instanceof Error) {
    fail(gm_A_creation_event.message);
}
gm_A.addEvent({
    ...gm_A_creation_event,
    parsedTags: getTags(gm_A_creation_event),
    publicKey: PublicKey.FromHex(gm_A_creation_event.pubkey) as PublicKey,
});
render(
    <div class={`${CenterClass}`}>
        <InviteButton
            userPublicKey={user_B.publicKey}
            groupChatController={gm_A}
            profileGetter={database}
            emit={testEventBus.emit}
        />
    </div>,
    document.body,
);

for await (const event of testEventBus.onChange()) {
    console.log(event);
    if (event.type == "InviteUsersToGroup") {
        console.log(event.groupPublicKey.hex, "=", gm_A_creation.groupKey.publicKey.hex);
        console.log(event.usersPublicKey[0].hex, "=", user_B.publicKey.hex);
    } else {
        throw new Error("impossible");
    }
}
