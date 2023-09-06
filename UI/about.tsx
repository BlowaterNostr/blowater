/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DividerClass } from "./components/tw.ts";
import { LinkColor, PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";

export function About() {
    return (
        <div
            class={tw`flex-1 overflow-hidden bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}]`}
        >
            <div class={tw`max-w-[50rem] p-[1rem] m-auto`}>
                <h1 class={tw`text-[1.8rem] font-bold`}>Blowater</h1>
                <div class={tw`${DividerClass}`}></div>
                <p>Blowater is delightful DM focusing Nostr client.</p>

                <p class={tw`mt-4`}>
                    It's here to replace Telegram/Slack/Discord alike centralized chat apps and give users a
                    strong privacy, globally available decentralized chat app.
                </p>

                <p class={tw`text-[1.3rem] font-bold mt-8`}>Creator</p>
                <a
                    class={tw`text-[${LinkColor}] hover:underline mt-4`}
                    target="_blank"
                    href="https://nostr.band/npub1dww6jgxykmkt7tqjqx985tg58dxlm7v83sa743578xa4j7zpe3hql6pdnf"
                >
                    Water Blowater
                </a>
                <p class={tw`mt-4 text-[1.2rem]`}>Donation</p>
                <p>
                    Lightning:{" "}
                    <a
                        class={tw`text-[${LinkColor}] hover:underline mt-4`}
                    >
                        blowater@getalby.com
                    </a>
                </p>
                <p class={tw`mt-4`}>
                    Open sourced at{" "}
                    <a
                        class={tw`text-[${LinkColor}] hover:underline mt-4`}
                        href="https://github.com/BlowaterNostr/blowater"
                        target="_blank"
                    >
                        GitHub
                    </a>
                </p>
            </div>
        </div>
    );
}
