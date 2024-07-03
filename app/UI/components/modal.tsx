/** @jsx h */
import { Component, ComponentChildren, h } from "preact";
import { Channel } from "@blowater/csp";
import { setState } from "../_helper.ts";

export type HideModal = {
    type: "HideModal";
    onClose?: () => void;
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
    onClose?: () => void;

    async componentDidMount() {
        for await (const { children, onClose } of this.props.inputChan) {
            this.onClose = onClose;
            if (children) {
                await this.show(children);
            } else {
                await this.hide();
            }
        }
    }

    show = async (children: ComponentChildren) => {
        this.children = children;
        await setState(this, { show: true });
    };

    hide = async () => {
        await setState(this, { show: false });
        if (this.onClose) this.onClose();
    };

    render() {
        if (!this.state.show) return;
        return (
            <div className="fixed inset-0 flex items-center justify-center z-15">
                <div
                    className="fixed inset-0 z-[-1] bg-[#0A0A0A] bg-opacity-50 cursor-pointer"
                    onClick={this.hide}
                />
                {this.children}
            </div>
        );
    }
}
