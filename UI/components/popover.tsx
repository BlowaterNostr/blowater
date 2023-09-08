/** @jsx h */
import { Component, ComponentChildren, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { SecondaryBackgroundColor } from "../style/colors.ts";

type Props = {
    children?: ComponentChildren;
    close: () => void;
    disableEsc?: boolean;
    disableBlankClick?: boolean;
};

export class Popover extends Component<Props> {
    styles = {
        container: tw`fixed inset-0 z-20`,
        backdrop: tw`fixed inset-0 z-[-1] backdrop-filter backdrop-blur cursor-pointer`,
        childrenContainer:
            tw`h-[80%] absolute top-[20%] overflow-auto bg-[${SecondaryBackgroundColor}] w-full shadow-inner`,
    };

    componentDidMount(): void {
        window.addEventListener("keydown", this.onEscKeyDown);
    }

    componentWillUnmount(): void {
        window.removeEventListener("keydown", this.onEscKeyDown);
    }

    onEscKeyDown = (e: KeyboardEvent) => {
        if (e.code == "Escape" && !this.props.disableEsc) {
            this.props.close();
        }
    };

    onBackdropClick = () => {
        if (!this.props.disableBlankClick) {
            this.props.close();
        }
    };

    render() {
        return (
            <div class={this.styles.container}>
                <div class={this.styles.backdrop} onClick={this.onBackdropClick}>
                </div>
                <div class={this.styles.childrenContainer}>
                    {this.props.children}
                </div>
            </div>
        );
    }
}
