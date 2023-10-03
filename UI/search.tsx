/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Avatar } from "./components/avatar.tsx";
import {
    DividerBackgroundColor,
    PlaceholderColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
} from "./style/colors.ts";
import { Component } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { emitFunc } from "../event-bus.ts";
import { SearchUpdate } from "./search_model.ts";
import { Database_Contextual_View } from "../database.ts";
import { getProfileEvent, getProfilesByName } from "../features/profile.ts";
import { Profile_Nostr_Event } from "../nostr.ts";
import { InvalidKey, PublicKey } from "../lib/nostr-ts/key.ts";

export type SearchResultChannel = Channel<SearchResult[]>;

type SearchResult = {
    picture: string | undefined;
    text: string;
    id: string;
};

type Props = {
    placeholder: string;
    db: Database_Contextual_View;
    emit: emitFunc<SearchUpdate>;
};

type State = {
    searchResults: Profile_Nostr_Event[] | PublicKey;
};

export class Search extends Component<Props, State> {
    state: State = { searchResults: [] };
    inputRef = createRef();
    styles = {
        container: tw`flex flex-col h-full w-full bg-[${SecondaryBackgroundColor}]`,
        searchInput:
            tw`p-2 w-full border-b border-[${DividerBackgroundColor}] focus-visible:outline-none bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}] placeholder-[${PlaceholderColor}]`,
        result: {
            container: tw`flex-1 list-none p-1 overflow-y-auto`,
            item: {
                container:
                    tw`w-full flex items-center px-4 py-2 text-[#B8B9BF] hover:bg-[#404249] rounded cursor-pointer`,
                avatar: tw`w-8 h-8 mr-2`,
                text: tw`truncate`,
            },
        },
    };

    search = (e: h.JSX.TargetedEvent<HTMLInputElement, Event>) => {
        const text = e.currentTarget.value;
        const pubkey = PublicKey.FromString(text);
        if (pubkey instanceof Error) {
            const profiles = getProfilesByName(this.props.db, text);
            console.log(profiles);
            this.setState({
                searchResults: profiles,
            });
        } else {
            const profile_event = getProfileEvent(this.props.db, pubkey);
            this.setState({
                searchResults: profile_event ? [profile_event] : pubkey,
            });
        }
        this.props.emit({
            type: "Search",
            text,
        });
    };

    onSelect = (profile: Profile_Nostr_Event | PublicKey) => () => {
        this.inputRef.current.value = "";
        this.setState({
            searchResults: [],
        });
        this.props.emit({
            type: "SelectConversation",
            pubkey: profile instanceof PublicKey ? profile : profile.publicKey,
            isGroupChat: false // todo
        });
    };

    render() {
        return (
            <div class={this.styles.container}>
                <input
                    ref={this.inputRef}
                    onInput={this.search}
                    type="text"
                    class={this.styles.searchInput}
                    placeholder={this.props.placeholder}
                />
                {this.state.searchResults instanceof PublicKey
                    ? (
                        <li
                            onClick={this.onSelect(this.state.searchResults)}
                            class={this.styles.result.item.container}
                        >
                            <Avatar
                                class={this.styles.result.item.avatar}
                                picture={undefined}
                            />
                            <p class={this.styles.result.item.text}>
                                {this.state.searchResults.bech32()}
                            </p>
                        </li>
                    )
                    : this.state.searchResults.length > 0
                    ? (
                        <ul class={this.styles.result.container}>
                            {this.state.searchResults.map((result) => {
                                return (
                                    <li
                                        onClick={this.onSelect(result)}
                                        class={this.styles.result.item.container}
                                    >
                                        <Avatar
                                            class={this.styles.result.item.avatar}
                                            picture={result.profile.picture}
                                        />
                                        <p class={this.styles.result.item.text}>
                                            {result.profile.name}
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
}
