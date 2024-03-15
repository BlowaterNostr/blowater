/** @jsx h */
import { Component } from "https://esm.sh/preact@10.17.1";
import { h } from "https://esm.sh/preact@10.17.1";
import { PrimaryBackgroundColor, PrimaryTextColor } from "../style/colors.ts";
import { Channel, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { setState } from "../_helper.ts";

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
            await setState(this, {
                content: message,
            });
            await sleep(2333);
            await setState(this, {
                content: "",
            });
        }
    }

    render() {
        const opacity = this.state.content ? "opacity-100" : "opacity-0";
        return (
            <div
                key={`${this.state.content}${Date.now()}`}
                class={`absolute bottom-0 right-0 px-4 py-2 mx-6 my-6 rounded shadow-2xl
                ${opacity}
                bg-[${PrimaryBackgroundColor}] text-[${PrimaryTextColor}] text-xs break-all`}
            >
                {this.state.content}
            </div>
        );
    }
}
