/** @jsx h */
import { Component } from "https://esm.sh/preact@10.17.1";
import { h } from "https://esm.sh/preact@10.17.1";
import { PrimaryBackgroundColor, PrimaryTextColor } from "../style/colors.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export type ToastChannel = Channel<string>;

type Props = {
    inputChan: ToastChannel;
};

type State = {
    content: string;
};

export class Toast extends Component<Props, State> {
    state = { content: "" };

    async componentDidMount() {
        for await (const message of this.props.inputChan) {
            this.setState({
                content: message,
            });
        }
    }

    render() {
        return this.state.content
            ? (
                <div
                    key={`${this.state.content}${Date.now()}`}
                    class={`animate-toast absolute left-full top-4 px-4 py-2 rounded shadow-2xl w-max max-w-xs bg-[${PrimaryBackgroundColor}] text-[${PrimaryTextColor}] text-xs break-all`}
                >
                    {this.state.content}
                </div>
            )
            : undefined;
    }
}
