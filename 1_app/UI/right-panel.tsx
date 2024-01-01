/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { emitFunc } from "../event-bus.ts";
import { IconButtonClass } from "./components/tw.ts";
import { CloseIcon } from "./icons/close-icon.tsx";
import { DirectMessagePanelUpdate } from "./message-panel.tsx";

export type RightPanelModel = {
    show: boolean;
};

type RightPanelProps = {
    emit: emitFunc<DirectMessagePanelUpdate>;
    rightPanelModel: RightPanelModel;
};

type RightPanelState = {
    show: boolean;
};

export class RightPanel extends Component<RightPanelProps, RightPanelState> {
    state: RightPanelState = {
        show: true,
    };

    render() {
        const { emit, children } = this.props;
        const { show } = this.state;

        return (
            <div
                class={`border-l fixed top-0 right-0 h-full bg-[#2F3136] overflow-hidden overflow-y-auto z-20 transition-all duration-300 ease-in-out w-96 max-w-full`}
            >
                <button
                    class={`w-6 min-w-[1.5rem] h-6 ml-4 ${IconButtonClass} hover:bg-[#36393F] absolute right-2 top-3 z-10 border-2`}
                    onClick={() => {
                        emit({
                            type: "ToggleRightPanel",
                            show: false,
                        });
                        this.setState({ show: !show });
                    }}
                >
                    <CloseIcon
                        class={`w-4 h-4`}
                        style={{
                            stroke: "rgb(185, 187, 190)",
                        }}
                    />
                </button>
                {children}
            </div>
        );
    }
}
