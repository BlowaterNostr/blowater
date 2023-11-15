/** @jsx h */
import { Attributes, ComponentChild, ComponentChildren, h, Ref } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DividerBackgroundColor, PrimaryTextColor, SuccessColor } from "../style/colors.ts";
import { CopyIcon } from "../icons/copy-icon.tsx";
import { CenterClass, NoOutlineClass } from "./tw.ts";
import { CheckIcon } from "../icons/check-icon.tsx";
import { Component } from "https://esm.sh/preact@10.17.1";
import { sleep } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

type Props = {
    class?: string | h.JSX.SignalLike<string | undefined>;
    text: string;
};

type State = {
    state: "copy" | "check";
};

export class CopyButton extends Component<Props, State> {
    styles = {
        button: tw`w-6 h-6 rounded-lg hover:bg-[${DividerBackgroundColor}] ${CenterClass} ${NoOutlineClass}`,
        copyIcon: tw`w-4 h-4 text-[${PrimaryTextColor}] stroke-current`,
        checkIcon: tw`w-4 h-4 text-[${SuccessColor}] stroke-current`,
    };
    state: State = {
        state: "copy",
    };

    onClick = async () => {
        if (this.state.state == "check") {
            return;
        }

        await navigator.clipboard.writeText(this.props.text);
        this.setState({
            state: "check",
        });

        await sleep(2000);
        this.setState({
            state: "copy",
        });
    };

    render() {
        return (
            <button
                class={[
                    this.styles.button,
                    this.props.class,
                ].join(" ")}
                onClick={this.onClick}
            >
                {this.state.state == "copy"
                    ? <CopyIcon style={{ fill: "none" }} class={this.styles.copyIcon} />
                    : <CheckIcon style={{ fill: "none" }} class={this.styles.checkIcon} />}
            </button>
        );
    }
}
