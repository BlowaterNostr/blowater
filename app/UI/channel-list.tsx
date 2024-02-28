import { Component, h } from "https://esm.sh/preact@10.17.1";
import { SelectChannel } from "./search_model.ts";
import { emitFunc } from "../event-bus.ts";

type ChannelListProps = {
    relay: string;
    currentSelected: string | undefined;
    emit: emitFunc<SelectChannel>;
    channels: string[];
};

export class ChannelList extends Component<ChannelListProps> {
    render() {
        return (
            <div>
                {this.props.channels.map((c) =>
                    this.ChannelListItem(this.props, c, c == this.props.currentSelected)
                )}
            </div>
        );
    }

    ChannelListItem(props: ChannelListProps, name: string, isSelected: boolean) {
        const selected = isSelected ? " bg-[#404248] text-[#fff]" : "";
        return (
            <div
                class={`m-2 p-1
                rounded
                text-[#959BA3]
                hover:text-[#fff]
                hover:bg-[#36373C]
                hover:cursor-pointer` + selected}
                onClick={selectChannel(
                    props.emit,
                    name,
                )}
            >
                # {name}
            </div>
        );
    }
}

const selectChannel = (emit: emitFunc<SelectChannel>, channel: string) => () => {
    return emit({
        type: "SelectChannel",
        channel,
    });
};
