/** @jsx h */
import { Component, ComponentChildren, h } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export type HideModal = {
    type: "HideModal";
};

type State = {
    show: boolean;
};

export type ModalInputChannel = Channel<{ children: ComponentChildren; onClose?: () => void }>;
export class Modal extends Component<{
    inputChan: ModalInputChannel;
}, State> {
    state: State = { show: false };
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
            this.state.show &&
            (
                <div class="fixed inset-0 flex items-center justify-center z-30">
                    <div
                        class="fixed inset-0 z-[-1] bg-[#0A0A0A] bg-opacity-50 cursor-pointer"
                        onClick={this.onBackdropClick}
                    >
                    </div>
                    <div class={`absolute`}>
                        {this.children}
                    </div>
                </div>
            )
        );
    }
}
