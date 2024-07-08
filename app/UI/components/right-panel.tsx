/** @jsx h */
import { Component, h } from "preact";
import { ComponentChildren } from "preact";
import { Channel } from "@blowater/csp";
import { XIcon } from "../icons/x-icon.tsx";

export type RightPanelChannel = Channel<(() => ComponentChildren) | undefined>;

type RightPanelProps = {
    inputChan: RightPanelChannel;
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

    render(_props: RightPanelProps, state: RightPanelState) {
        return (
            <div
                class={`${state.children ? "" : "translate-x-full"} fixed top-0 right-0
                    overflow-auto p-4
                    h-full bg-neutral-600
                    z-20 transition duration-150 ease-in-out w-96 max-w-full
                    `}
            >
                <button
                    class={`h-8 w-8 hover:bg-neutral-500 absolute right-2 top-3 z-10 rounded-full flex justify-center items-center`}
                    onClick={() => {
                        this.setState({ children: undefined });
                    }}
                >
                    <XIcon class="w-6 h-6 text-neutral-400" />
                </button>
                {state.children ? state.children() : undefined}
            </div>
        );
    }
}

export type CloseRightPanel = {
    type: "CloseRightPanel";
};
