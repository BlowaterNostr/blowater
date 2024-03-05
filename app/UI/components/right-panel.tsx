/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { IconButtonClass } from "./tw.ts";
import { CloseIcon } from "../icons/close-icon.tsx";
import { ComponentChildren } from "https://esm.sh/preact@10.17.1";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

type RightPanelProps = {
    inputChan: Channel<() => ComponentChildren>;
};

type RightPanelState = {
    children?: () => ComponentChildren;
};

export class RightPanel extends Component<RightPanelProps, RightPanelState> {
    state = {
        children: undefined,
    };

    async componentDidMount() {
        for await (const children of this.props.inputChan) {
            this.setState({ children });
        }
    }

    render(props: RightPanelProps, state: RightPanelState) {
        return (
            <div
                class={`${state.children ? "" : "translate-x-full"} fixed top-0 right-0 border-l
                    overflow-auto
                    h-full bg-[#2F3136]
                    z-20 transition duration-150 ease-in-out w-96 max-w-full
                    `}
            >
                <button
                    class={`w-6 min-w-[1.5rem] h-6 ml-4 ${IconButtonClass} hover:bg-[#36393F] absolute right-2 top-3 z-10 border-2`}
                    onClick={() => {
                        this.setState({ children: undefined });
                    }}
                >
                    <CloseIcon
                        class={`w-4 h-4`}
                        style={{
                            stroke: "rgb(185, 187, 190)",
                        }}
                    />
                </button>
                {state.children ? state.children() : undefined}
            </div>
        );
    }
}
