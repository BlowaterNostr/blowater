/** @jsx h */
import { Component, createRef, h } from "https://esm.sh/preact@10.17.1";
import { IconButtonClass } from "./tw.ts";
import { CloseIcon } from "../icons/close-icon.tsx";
import { ComponentChildren } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

type RightPanelProps = {
    inputChan: RightPanelInputChannel;
};

type RightPanelState = {
    show: boolean;
};

export type RightPanelInputChannel = Channel<ComponentChildren>;
export class RightPanel extends Component<RightPanelProps, RightPanelState> {
    state = {
        show: false,
    };
    children: ComponentChildren = undefined;

    ref = createRef<HTMLDivElement>();

    async componentDidMount() {
        for await (const children of this.props.inputChan) {
            if (children) {
                this.show(children);
            } else {
                this.hide();
            }
        }
    }

    show = (children: ComponentChildren) => {
        this.setState({ show: true });
        this.children = children;
        const ele = this.ref.current;
        if (ele) ele.classList.remove("translate-x-full");
    };

    hide = () => {
        this.setState({ show: false });
        const ele = this.ref.current;
        if (ele) ele.classList.add("translate-x-full");
    };

    render() {
        return (
            <div
                ref={this.ref}
                class={`fixed top-0 right-0 border-l
                    overflow-auto
                    h-full bg-[#2F3136]
                    z-20 transition duration-150 ease-in-out w-96 max-w-full
                    translate-x-full`}
            >
                <button
                    class={`w-6 min-w-[1.5rem] h-6 ml-4 ${IconButtonClass} hover:bg-[#36393F] absolute right-2 top-3 z-10 border-2`}
                    onClick={() => {
                        this.hide();
                    }}
                >
                    <CloseIcon
                        class={`w-4 h-4`}
                        style={{
                            stroke: "rgb(185, 187, 190)",
                        }}
                    />
                </button>
                {this.children}
            </div>
        );
    }
}
