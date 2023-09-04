/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { EventEmitter } from "../event-bus.ts";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

import { SearchModel, SearchUpdate } from "./search_model.ts";
import { Avatar } from "./components/avatar.tsx";
import {
    DividerBackgroundColor,
    PlaceholderColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";

export function Search(props: {
    eventEmitter: EventEmitter<SearchUpdate>;
    model: SearchModel;
}) {
    return (
        <div class={tw`flex flex-col h-full w-full`}>
            <input
                ref={async (e) => {
                    await sleep(0); // wait util element mounted
                    e?.focus();
                }}
                onInput={(e) => {
                    props.eventEmitter.emit({
                        type: "Search",
                        text: e.currentTarget.value,
                    });
                }}
                type="text"
                class={tw`p-2 w-full border-b border-[${DividerBackgroundColor}] focus-visible:outline-none bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}] placeholder-[${PlaceholderColor}]`}
                placeholder="Search a user's public key or name"
            />
            {props.model.searchResults.length > 0
                ? (
                    <ul
                        class={tw`flex-1 list-none p-1 overflow-y-auto`}
                    >
                        {props.model.searchResults.map((result) => {
                            return (
                                <li
                                    onClick={() => {
                                        props.eventEmitter.emit({
                                            type: "SelectProfile",
                                            pubkey: result.pubkey,
                                        });
                                    }}
                                    class={tw`w-full flex items-center px-4 py-2 text-[#B8B9BF] hover:bg-[#404249] rounded cursor-pointer`}
                                >
                                    <Avatar
                                        class={tw`w-8 h-8 mr-2`}
                                        picture={result.profile?.picture}
                                    />
                                    <p class={tw`truncate`}>
                                        {result.profile?.name ? result.profile.name : result.pubkey.bech32()}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                )
                : undefined}
        </div>
    );
}
