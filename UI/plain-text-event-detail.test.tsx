/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { PlainTextEventDetail } from "./plain-text-event-detail.tsx";
import { PlainText_Nostr_Event } from "../nostr.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";

const testPlainTextEvent: PlainText_Nostr_Event = {
    id: "00506d355aafccf25f321ffef3f1f88eea36523eee7d498003baa2922a1199be",
    sig: "2a32e2705fbfcbb756978b623b840e141b394d697722f98538049d8590549c4cf8895b9acc6c4bdf5d02756ae7e764e2363179ac680baa07020613934bc2d15b",
    pubkey: "6b9da920c4b6ecbf2c12018a7a2d143b4dfdf9878c3beac69e39bb597841cc6e",
    kind: 4,
    created_at: 1687185135,
    tags: [
        ["p", "adb13ef51c701cea63b82ed41f5288389fc4051e10b13c0bffa77e7d61c996bd"],
        ["lamport", "3409"],
    ],
    content: "back",
    parsedTags: {
        p: ["adb13ef51c701cea63b82ed41f5288389fc4051e10b13c0bffa77e7d61c996bd"],
        e: [],
    },
    publicKey: PublicKey.FromString(
        "6b9da920c4b6ecbf2c12018a7a2d143b4dfdf9878c3beac69e39bb597841cc6e",
    ) as PublicKey,
    parsedContentItems: [],
};

function PlainTextEventDetailTest() {
    return <PlainTextEventDetail plainTextEvent={testPlainTextEvent} />;
}

render(<PlainTextEventDetailTest />, document.body);
