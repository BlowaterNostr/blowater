/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { Component } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { PrimaryTextColor } from "./style/colors.ts";
import { DownloadIcon } from "./icons/download-icon.tsx";
import { IconButtonClass, LinearGradientsClass } from "./components/tw.ts";
import { CloseIcon } from "./icons/close-icon.tsx";
import { Listener } from "./_listener.ts";

type State = {
    installEvent: Event | undefined;
};

export class InstallPrompt extends Component<{}, State> {
    styles = {
        container:
            tw`absolute bottom-4 mobile:bottom-20 ${LinearGradientsClass} max-w-sm z-30 right-4 px-4 py-2 rounded text-[${PrimaryTextColor}] flex cursor-pointer`,
        icon: tw`text-[${PrimaryTextColor}] stroke-current w-6 h-6 mr-2`,
        text: tw`hover:underline`,
        close: tw`${IconButtonClass} w-6 h-6 ml-2 -top-1.5 -right-1.5 bg-[#42464D] absolute`,
        closeIcon: tw`text-[${PrimaryTextColor}] stroke-current w-4 h-4`,
    };

    async componentDidMount() {
        for await (const event of Listener.installPromptListener) {
            this.setState({
                installEvent: event,
            });
        }
    }

    install = async () => {
        if (!this.state.installEvent) {
            return;
        }
        try {
            // @ts-ignore
            await this.state.installEvent.prompt();
            this.setState({
                installEvent: undefined,
            });
        } catch (e) {
            console.error(e);
        }
    };

    close = (e: Event) => {
        e.stopPropagation();

        this.setState({
            installEvent: undefined,
        });
    };

    render() {
        return (
            this.state.installEvent
                ? (
                    <div
                        onClick={this.install}
                        class={this.styles.container}
                    >
                        <DownloadIcon class={this.styles.icon} />
                        <span class={this.styles.text}>Install Blowater</span>
                        <button class={this.styles.close} onClick={(e) => this.close(e)}>
                            <CloseIcon class={this.styles.closeIcon} />
                        </button>
                    </div>
                )
                : undefined
        );
    }
}
