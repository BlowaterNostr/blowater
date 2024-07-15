/** @jsx h */
import { h, render } from "preact";
import { NewNav } from "./nav.tsx";
import { prepareProfileEvent, testEventBus } from "./_setup.test.ts";
import { ConnectionPool, InMemoryAccountContext, PublicKey } from "@blowater/nostr-sdk";
import { ConversationSummary } from "./conversation-list.ts";

const pool = new ConnectionPool();
await pool.addRelayURLs(
    [
        "blowater.nostr1.com",
        "nos.lol",
        "relay.damus.io",
        "nostr.wine",
        "wss://relay.nostr.wirednet.jp",
        "wss://relay.nostr.moctane.com",
        "wss://remnant.cloud",
        "wss://nostr.cahlen.org",
        "wss://fog.dedyn.io",
        "wss://global-relay.cesc.trade",
        "wss://nostr.dakukitsune.ca",
        "wss://africa.nostr.joburg",
        "wss://nostr-relay.ktwo.io",
        "wss://bevo.nostr1.com",
        "wss://relay.corpum.com",
        "wss://relay.nostr.directory",
        "wss://nostr.1f52b.xyz",
        "wss://lnbits.eldamar.icu/nostrrelay/relay",
        "wss://relay.cosmicbolt.net",
        "wss://island.nostr1.com",
        "wss://nostr.codingarena.de",
        "wss://nostr.madco.me",
        "wss://nostr-relay.bitcoin.ninja",
    ],
);
const ctx = InMemoryAccountContext.Generate();
const profileEvent = await prepareProfileEvent(ctx, {
    name: "test_name",
    display_name: "Orionna Lumis",
    about:
        "Celestial bodies move in a harmonious dance, bound by the tether of gravity. Their ballet paints stories in the sky.",
    website: "https://github.com",
    picture: "https://image.nostr.build/655007ae74f24ea1c611889f48b25cb485b83ab67408daddd98f95782f47e1b5.jpg",
});

let currentConversation: PublicKey | undefined;
const convoList = new Array<ConversationSummary>();
const pinList = new Set<string>();
for (let i = 0; i < 50; i++) {
    const pubkey = InMemoryAccountContext.Generate().publicKey;
    if (i % 4 == 0) pinList.add(pubkey.hex);
    if (i == 5) currentConversation = pubkey;
    convoList.push({
        pubkey: pubkey,
        relays: [],
    });
}

render(
    <NewNav
        currentSpaceURL={new URL("wss://blowater.nostr1.com")}
        spaceList={[]}
        activeNav={"Public"}
        profile={profileEvent}
        currentConversation={currentConversation}
        getters={{
            getProfileByPublicKey: () => profileEvent,
            getConversationList: () => convoList,
            getPinList: () => pinList,
        }}
        update={testEventBus}
        emit={testEventBus.emit}
    />,
    document.body,
);

for await (const event of testEventBus.onChange()) {
    console.log(event);
}
