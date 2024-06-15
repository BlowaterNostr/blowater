/** @jsx h */
import { Component, ComponentChildren, h } from "https://esm.sh/preact@10.17.1";
import { SecondaryBackgroundColor } from "../style/colors.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export type HidePopOver = {
    type: "HidePopOver";
};

type State = {
    show: boolean;
};
export type PopOverInputChannel = Channel<{ children: ComponentChildren; onClose?: () => void }>;
export class Popover extends Component<{
    inputChan: PopOverInputChannel;
}, State> {
    state = { show: false };
    styles = {
        container: `fixed inset-0 z-20`,
        backdrop: `fixed inset-0 z-[-1] backdrop-filter backdrop-blur cursor-pointer`,
        childrenContainer:
            `h-[80%] absolute top-[20%] overflow-auto bg-[${SecondaryBackgroundColor}] w-full shadow-inner border-t`,
    };
    children: ComponentChildren = undefined;

    async componentDidMount() {
        for await (const { children, onClose } of this.props.inputChan) {
            if (children) {
                this.show(children);
            } else {
                this.hide(onClose);
            }
        }
    }

    show = (children: ComponentChildren) => {
        this.children = children;
        this.setState({ show: true });
        globalThis.addEventListener("keydown", this.onEscKeyDown);
    };

    hide = (onClose?: () => void) => {
        this.setState({ show: false });
        globalThis.removeEventListener("keydown", this.onEscKeyDown);

        if (onClose) {
            onClose();
        }
    };

    onEscKeyDown = (e: KeyboardEvent) => {
        if (e.code == "Escape") {
            this.hide();
        }
    };

    onBackdropClick = () => {
        this.hide();
    };

    render() {
        return (
            this.state.show
                ? (
                    <div class={this.styles.container}>
                        <div class={this.styles.backdrop} onClick={this.onBackdropClick}>
                        </div>
                        <div class={this.styles.childrenContainer}>
                            {this.children}
                        </div>
                    </div>
                )
                : undefined
        );
    }
}
