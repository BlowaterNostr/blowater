/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { InviteIcon } from "./icons2/invite-icon.tsx";
import { DividerBackgroundColor, HoverButtonBackgroudColor, PrimaryTextColor } from "./style/colors.ts";
import { NoOutlineClass } from "./components/tw.ts";

type State = {
    show: boolean;
};

export class InviteButton extends Component<{}, State> {
    state = { show: false };
    styles = {
        button: {
            container:
                tw`w-6 h-6 flex items-center justify-center relative bg-[${DividerBackgroundColor}] hover:[${HoverButtonBackgroudColor}] ${NoOutlineClass}`,
            icon: tw`w-4 h-4 scale-150 fill-current text-[${PrimaryTextColor}]`,
        },
        ul: tw`absolute top-6 rounded right-0 text-[${PrimaryTextColor}] bg-[${HoverButtonBackgroudColor}] z-20`,
        li: tw`p-2 text-left hover:bg-[${DividerBackgroundColor}] first:rounded-t last:rounded-b`,
    };

    render() {
        return (
            <button
                class={this.styles.button.container}
                onMouseOver={() => {
                    this.setState({
                        show: true,
                    });
                }}
                onMouseLeave={() => {
                    this.setState({
                        show: false,
                    });
                }}
                onClick={(e) => {
                    e.stopPropagation();
                }}
            >
                <InviteIcon class={this.styles.button.icon} />
                {this.state.show
                    ? (
                        <ul
                            class={this.styles.ul}
                            style={{
                                boxShadow: "2px 2px 5px 0 black",
                            }}
                        >
                            <li class={this.styles.li}>adsfsaf</li>
                            <li class={this.styles.li}>ggdsgdffdsafdsa</li>
                            <li class={this.styles.li}>ssdf</li>
                        </ul>
                    )
                    : undefined}
            </button>
        );
    }
}
