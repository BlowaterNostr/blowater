/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { InviteCard } from "./invite-card.tsx";

render(
    <InviteCard
        name="test group test group test group test group test group test group"
        description="this is a test group this is a test group this is a test group this is a test group"
        onJoin={() => {
            console.log("join");
        }}
    />,
    document.body,
);
