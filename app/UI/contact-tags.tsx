/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { HintTextColor, PrimaryTextColor, SecondaryTextColor } from "./style/colors.ts";

type Props = {
    tags: string[];
};

type State = {
    tags: {
        name: string;
        selected: boolean;
    }[];
};

export class ContactTags extends Component<Props, State> {
    state: State = {
        tags: this.props.tags.map((tag) => ({
            name: tag,
            selected: false,
        })),
    };

    render() {
        return (
            <div>
                {/* https://tailwindcolor.com/ */}
                {Array.from(this.state.tags).map((tag) => (
                    <div
                        class={`m-1 px-2 rounded-full inline-block
                            hover:cursor-pointer select-none
                            text-white hover:text-black
                            ${tag.selected ? "border-2 border-cyan-300" : ""}
                            bg-green-400 hover:bg-white`}
                        onClick={(e) => {
                            tag.selected = !tag.selected;
                            this.setState({
                                tags: this.state.tags,
                            });
                        }}
                    >
                        {tag.name}
                    </div>
                ))}
            </div>
        );
    }
}
