import { Component, h } from "https://esm.sh/preact@10.17.1";

import { emitFunc } from "../event-bus.ts";

type Props = {
    relay: string;
    currentSelected: string | undefined;
    emit: emitFunc<>;
    channels: string[];
};

export class PublicFilterList extends Component<Props> {
    render() {
        return (
            <div>
                {this.props.channels.map((c) =>
                    this.ChannelListItem(this.props, c, c == this.props.currentSelected)
                )}
            </div>
        );
    }

    ChannelListItem(props: Props, name: string, isSelected: boolean) {
        const selected = isSelected ? " bg-[#404248] text-[#fff]" : "";
        return (
            <div
                class={`m-2 p-1
                rounded
                text-[#959BA3]
                hover:text-[#fff]
                hover:bg-[#36373C]
                hover:cursor-pointer` + selected}
            >
                # {name}
            </div>
        );
    }
}
