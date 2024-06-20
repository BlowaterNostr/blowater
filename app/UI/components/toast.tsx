/** @jsx h */
import { Component, ComponentChildren } from "https://esm.sh/preact@10.17.1";
import { h } from "https://esm.sh/preact@10.17.1";
import { LinkColor, PrimaryBackgroundColor, PrimaryTextColor } from "../style/colors.ts";
import { Channel, sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { setState } from "../_helper.ts";
import { emitFunc } from "../../event-bus.ts";
import { ViewSpaceSettings } from "../setting.tsx";

export type ToastChannel = Channel<() => ComponentChildren>;

type Props = {
    inputChan: ToastChannel;
};

type State = {
    content: ComponentChildren;
};

export class Toast extends Component<Props, State> {
    state = { content: undefined };

    async componentDidMount() {
        for await (const message of this.props.inputChan) {
            await setState(this, {
                content: message(),
            });
            await sleep(5000);
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

export const SendingEventRejection =
    (emit: emitFunc<ViewSpaceSettings>, url: string, reason: string) => () => (
        <div
            class="hover:cursor-pointer"
            onClick={() => {
                emit({
                    type: "ViewSpaceSettings",
                    url: url,
                });
            }}
        >
            sending message is rejected
            <div>reason: {reason}</div>
            <div>please contact the admin of relay</div>
            <div
                class={`text-[${LinkColor}] hover:underline`}
            >
                {url}
            </div>
        </div>
    );
