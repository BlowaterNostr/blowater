/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../0_lib/nostr-ts/key.ts";
import { emitFunc } from "../event-bus.ts";
import { DividerClass } from "./components/tw.ts";
import { SelectConversation } from "./search_model.ts";
import { LinkColor, PrimaryTextColor, SecondaryBackgroundColor } from "./style/colors.ts";

export function About(emit: emitFunc<SelectConversation>) {
    return (
        <div
            class={`flex-1 overflow-hidden bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}]`}
        >
            <div class={`max-w-[50rem] p-[1rem] m-auto`}>
                <h1 class={`text-[1.8rem] font-bold`}>Blowater</h1>
                <div class={`${DividerClass}`}></div>
                <p>Blowater is delightful DM focusing Nostr client.</p>

                <p class={`mt-4`}>
                    It's here to replace Telegram/Slack/Discord alike centralized chat apps and give users a
                    strong privacy, globally available decentralized chat app.
                </p>

                <p class={`text-[1.3rem] font-bold mt-8`}>Creator</p>
                <a
                    class={`text-[${LinkColor}] hover:underline mt-4 hover:cursor-pointer`}
                    target="_blank"
                    onClick={() => {
                        const pub = PublicKey.FromBech32(
                            "npub1dww6jgxykmkt7tqjqx985tg58dxlm7v83sa743578xa4j7zpe3hql6pdnf",
                        );
                        if (pub instanceof Error) throw pub;
                        emit({
                            type: "SelectConversation",
                            isGroupChat: false,
                            pubkey: pub,
                        });
                    }}
                >
                    Water Blower (feel free to ask me questions)
                </a>
                <p class={`mt-4 text-[1.2rem]`}>Donation</p>
                <p>
                    Lightning:{" "}
                    <a
                        class={`text-[${LinkColor}] hover:underline mt-4`}
                    >
                        blowater@getalby.com
                    </a>
                </p>
                <p class={`mt-4`}>
                    Open sourced at{" "}
                    <a
                        class={`text-[${LinkColor}] hover:underline mt-4`}
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
