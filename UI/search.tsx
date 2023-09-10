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

export const SearchResultsChan = new Channel<SearchResult[]>();

type SearchResult = {
    picture: string | undefined;
    text: string;
    id: string;
};

type Props = {
    placeholder: string;
    onInput: (text: string) => void;
    onSelect: (id: string) => void;
};

type State = {
    searchResults: SearchResult[];
};

export class Search extends Component<Props, State> {
    state = { searchResults: [] as SearchResult[] };
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

    async componentDidMount() {
        this.inputRef.current.focus();

        for await (const searchResults of SearchResultsChan) {
            this.setState({
                searchResults: searchResults || [],
            });
        }
    }

    search = (e: h.JSX.TargetedEvent<HTMLInputElement, Event>) => {
        const text = e.currentTarget.value;
        this.props.onInput(text);
    };

    onSelect = (id: string) => {
        this.inputRef.current.value = "";
        this.setState({
            searchResults: [],
        });
        this.props.onSelect(id);
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
                {this.state.searchResults.length > 0
                    ? (
                        <ul class={this.styles.result.container}>
                            {this.state.searchResults.map((result) => {
                                return (
                                    <li
                                        onClick={() => this.onSelect(result.id)}
                                        class={this.styles.result.item.container}
                                    >
                                        <Avatar
                                            class={this.styles.result.item.avatar}
                                            picture={result.picture}
                                        />
                                        <p class={this.styles.result.item.text}>
                                            {result.text}
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
