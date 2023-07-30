/** @jsx h */
import { Fragment, h, VNode } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { EventEmitter } from "../event-bus.ts";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

import { SearchModel, SearchUpdate } from "./search_model.ts";
import { Avatar } from "./components/avatar.tsx";

export function Popover(props: {
    eventEmitter: EventEmitter<SearchUpdate>;
    model: SearchModel;
    child: VNode;
}) {
    return (
        <div
            onKeyDown={(e) => {
                if (e.code === "Escape") {
                    props.eventEmitter.emit({ type: "CancelPopOver" });
                }
            }}
            class={tw`fixed inset-0 bg-[#000000C0] items-center justify-center flex z-20`}
        >
            <div
                class={tw`fixed inset-0 z-[-1]`}
                onClick={() => {
                    props.eventEmitter.emit({ type: "CancelPopOver" });
                }}
            >
            </div>
            <div
                class={tw`absolute max-w-[40rem] w-3/5 max-h-[24.72rem] bg-[#2B2D31] rounded-2xl px-4 py-3 flex flex-col z-10`}
            >
                {props.child}
            </div>
        </div>
    );
}

export function Search(props: {
    eventEmitter: EventEmitter<SearchUpdate>;
    model: SearchModel;
}) {
    return (
        <Fragment>
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
                class={tw`p-2 rounded focus-visible:outline-none bg-[#1E1F22] text-[#DADBDF] placeholder-[#86888B]`}
                placeholder="Search a user's public key"
            />
            {props.model.searchResults.length > 0
                ? (
                    <ul
                        class={tw`flex-1 list-none mt-4 p-1 overflow-y-auto`}
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
        </Fragment>
    );
}
