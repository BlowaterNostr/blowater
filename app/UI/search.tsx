/** @jsx h */
import { createRef, h } from "preact";
import { Avatar } from "./components/avatar.tsx";
import {
    BackgroundColor_HoverButton,
    DividerBackgroundColor,
    PlaceholderColor,
    PrimaryTextColor,
    SecondaryBackgroundColor,
    TextColor_Primary,
} from "./style/colors.ts";
import { Component } from "preact";
import { Channel } from "@blowater/csp";
import { emitFunc } from "../event-bus.ts";
import { SearchUpdate } from "./search_model.ts";
import { Profile_Nostr_Event } from "../nostr.ts";
import { PublicKey, robohash } from "@blowater/nostr-sdk";

export type SearchResultChannel = Channel<SearchResult[]>;

type SearchResult = {
    picture: string | undefined;
    text: string;
    id: string;
};

export interface ProfileSetter {
    setProfile(profileEvent: Profile_Nostr_Event, relayURL: string): void;
}

export type func_GetProfileByPublicKey = (pubkey: PublicKey | string) => Profile_Nostr_Event | undefined;
export type func_GetProfilesByText = (input: string) => Profile_Nostr_Event[];
export interface ProfileGetter {
    getProfilesByText: (spaceURL: string) => func_GetProfilesByText;
    getProfileByPublicKey: (spaceURL: string) => func_GetProfileByPublicKey;
    getUniqueProfileCount: (spaceURL: string) => number;
}

type Props = {
    placeholder: string;
    getProfilesByText: func_GetProfilesByText;
    getProfileByPublicKey: func_GetProfileByPublicKey;
    emit: emitFunc<SearchUpdate>;
};

type State = {
    searchResults: Profile_Nostr_Event[] | PublicKey;
    offset: number;
};

const page_size = 9;
export class Search extends Component<Props, State> {
    state: State = {
        searchResults: [],
        offset: 0,
    };

    inputRef = createRef<HTMLInputElement>();

    styles = {
        container: `flex flex-col h-full w-full bg-[${SecondaryBackgroundColor}]`,
        searchInput:
            `p-2 w-full border-b border-[${DividerBackgroundColor}] focus-visible:outline-none bg-[${SecondaryBackgroundColor}] text-[${PrimaryTextColor}] placeholder-[${PlaceholderColor}]`,
        result: {
            container: `flex-1 list-none p-1 overflow-y-auto`,
            item: {
                container:
                    `w-full flex items-center px-4 py-2 text-[#B8B9BF] hover:bg-[#404249] rounded cursor-pointer`,
                avatar: `w-8 h-8 mr-2`,
                text: `truncate`,
            },
        },
    };

    componentDidMount() {
        if (this.inputRef.current) {
            this.inputRef.current.focus();
        }
    }

    search = (e: h.JSX.TargetedEvent<HTMLInputElement, Event>) => {
        this.setState({
            offset: 0,
        });
        const text = e.currentTarget.value;
        const pubkey = PublicKey.FromString(text);
        if (pubkey instanceof Error) {
            const profiles = this.props.getProfilesByText(text);
            this.setState({
                searchResults: profiles,
            });
        } else {
            const profile_event = this.props.getProfileByPublicKey(pubkey);
            this.setState({
                searchResults: profile_event ? [profile_event] : pubkey,
            });
        }
    };

    onSelect = (profile: Profile_Nostr_Event | PublicKey) => () => {
        if (this.inputRef.current) {
            this.inputRef.current.value = "";
        }
        this.setState({
            searchResults: [],
        });
        this.props.emit({
            type: "SelectConversation",
            pubkey: profile instanceof PublicKey ? profile : profile.publicKey,
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
                <div class={`flex flex-row justify-evenly ${TextColor_Primary}`}>
                    <button
                        class={`border px-2 mt-1 rounded hover:${BackgroundColor_HoverButton}`}
                        onClick={() => {
                            const newOffset = this.state.offset - page_size;
                            if (newOffset >= 0) {
                                this.setState({
                                    offset: newOffset,
                                });
                            }
                        }}
                    >
                        previous page
                    </button>
                    <button
                        class={`border px-2 mt-1 rounded hover:${BackgroundColor_HoverButton}`}
                        onClick={() => {
                            if (this.state.searchResults instanceof PublicKey) {
                                return;
                            }
                            const newOffset = this.state.offset + page_size;
                            if (newOffset < this.state.searchResults.length) {
                                this.setState({
                                    offset: newOffset,
                                });
                            }
                        }}
                    >
                        next page
                    </button>
                </div>
                {this.state.searchResults instanceof PublicKey
                    ? this.pubkeyItem(this.state.searchResults)
                    : this.state.searchResults.length > 0
                    ? (
                        <ul class={this.styles.result.container}>
                            {this.state.searchResults.slice(
                                this.state.offset,
                                this.state.offset + page_size,
                            ).map(this.profileItem)}
                        </ul>
                    )
                    : undefined}
            </div>
        );
    }

    pubkeyItem = (pubkey: PublicKey) => {
        return (
            <li
                onClick={this.onSelect(pubkey)}
                class={this.styles.result.item.container}
            >
                <Avatar
                    class={this.styles.result.item.avatar}
                    picture={robohash(pubkey.hex)}
                />
                <p class={this.styles.result.item.text}>
                    {pubkey.bech32()}
                </p>
            </li>
        );
    };

    profileItem = (result: Profile_Nostr_Event) => {
        return (
            <li
                onClick={this.onSelect(result)}
                class={this.styles.result.item.container}
            >
                <Avatar
                    class={this.styles.result.item.avatar}
                    picture={result.profile.picture || robohash(result.pubkey)}
                />
                <p class={this.styles.result.item.text}>
                    {result.profile.name || result.profile.display_name}
                </p>
            </li>
        );
    };
}
