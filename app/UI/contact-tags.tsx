/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { HintTextColor, PrimaryTextColor, SecondaryTextColor } from "./style/colors.ts";
import { emitFunc } from "../event-bus.ts";

export type TagSelected = {
    type: "tagSelected";
    tag: Tag;
};

export type Tag = "contacts" | "strangers" | "blocked";

type Props = {
    tags: Tag[];
    emit: emitFunc<TagSelected>;
};

type State = {
    selectedTag: Tag | undefined;
};

export class ContactTags extends Component<Props, State> {
    state: State = {
        selectedTag: undefined,
    };

    render() {
        return (
            <div>
                {/* https://tailwindcolor.com/ */}
                {Array.from(this.props.tags).map((tag) => (
                    <div
                        class={`m-1 px-2 rounded-full inline-block
                            hover:cursor-pointer select-none
                            text-white hover:text-black
                            ${tag == this.state.selectedTag ? "border-2 border-cyan-300" : ""}
                            bg-green-400 hover:bg-white`}
                        onClick={(e) => {
                            this.setState({
                                selectedTag: tag,
                            });
                            this.props.emit({
                                type: "tagSelected",
                                tag: tag,
                            });
                        }}
                    >
                        {tag}
                    </div>
                ))}
            </div>
        );
    }
}
