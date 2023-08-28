/** @jsx h */
import {
    Component,
    ComponentChild,
    ComponentChildren,
    h,
    RenderableProps,
} from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { SecondaryBackgroundColor } from "../style/colors.ts";

type PopoverProps = {
    escapeClose?: boolean;
    blankClickClose?: boolean;
    close: () => void;
    children: ComponentChildren;
};

export class Popover extends Component<PopoverProps> {
    componentDidMount() {
        if (this.props.escapeClose) {
            window.addEventListener("keydown", this.handleKeyDown);
        }
    }

    componentWillUnmount() {
        window.removeEventListener("keydown", this.handleKeyDown);
    }

    handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Escape") {
            this.props.close();
        }
    };

    render() {
        return (
            <div class={tw`fixed inset-0 z-20`}>
                <div
                    class={tw`fixed inset-0 z-[-1] backdrop-filter backdrop-blur cursor-pointer`}
                    onClick={this.props.blankClickClose
                        ? () => {
                            this.props.close();
                        }
                        : undefined}
                >
                </div>
                <div
                    class={tw`h-[80%] absolute top-[20%] overflow-auto bg-[${SecondaryBackgroundColor}] w-full`}
                    style={{
                        boxShadow: "rgba(0, 0, 0, 0.35) 0px 5px 15px",
                    }}
                >
                    {this.props.children}
                </div>
            </div>
        );
    }
}
