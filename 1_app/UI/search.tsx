/** @jsx h */
import { createRef, h } from "https://esm.sh/preact@10.17.1";
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
import { Profile_Nostr_Event } from "../nostr.ts";
import { PublicKey } from "../../0_lib/nostr-ts/key.ts";

export type SearchResultChannel = Channel<SearchResult[]>;

type SearchResult = {
    picture: string | undefined;
    text: string;
    id: string;
};

export type ProfileController = ProfileSetter & ProfileGetter;

export interface ProfileSetter {
    setProfile(profileEvent: Profile_Nostr_Event): void;
}

export interface ProfileGetter {
    getProfilesByText(input: string): Profile_Nostr_Event[];
    getProfilesByPublicKey(pubkey: PublicKey): Profile_Nostr_Event | undefined;
}

type Props = {
    placeholder: string;
    db: ProfileGetter;
    emit: emitFunc<SearchUpdate>;
};

type State = {
    searchResults: Profile_Nostr_Event[] | PublicKey;
};

export class Search extends Component<Props, State> {
    state: State = { searchResults: [] };
    inputRef = createRef();
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
        this.inputRef.current?.focus();
    }

    search = (e: h.JSX.TargetedEvent<HTMLInputElement, Event>) => {
        const text = e.currentTarget.value;
        const pubkey = PublicKey.FromString(text);
        if (pubkey instanceof Error) {
            const profiles = this.props.db.getProfilesByText(text);
            this.setState({
                searchResults: profiles,
            });
        } else {
            const profile_event = this.props.db.getProfilesByPublicKey(pubkey);
            this.setState({
                searchResults: profile_event ? [profile_event] : pubkey,
            });
        }
    };

    onSelect = (profile: Profile_Nostr_Event | PublicKey) => () => {
        this.inputRef.current.value = "";
        this.setState({
            searchResults: [],
        });
        this.props.emit({
            type: "SelectConversation",
            pubkey: profile instanceof PublicKey ? profile : profile.publicKey,
            isGroupChat: false, // todo
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
