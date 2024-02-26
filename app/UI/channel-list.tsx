import { Component, h } from "https://esm.sh/preact@10.17.1";
import { setState } from "./_helper.ts";
import { SecondaryBackgroundColor } from "./style/colors.ts";
import { SelectChannel } from "./search_model.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { emitFunc, EventSubscriber } from "../event-bus.ts";

type ChannelListProps = {
    emit: emitFunc<SelectChannel>;
    eventSub: EventSubscriber<UI_Interaction_Event>;
    channels: string[];
};

type ChannelListState = {
    currentSelected: SelectChannel | undefined;
};

export class ChannelList extends Component<ChannelListProps, ChannelListState> {
    state: Readonly<ChannelListState> = {
        currentSelected: undefined,
    };

    async componentDidMount() {
        for await (const e of this.props.eventSub.onChange()) {
            if (e.type == "SelectChannel") {
                this.setState({
                    currentSelected: e,
                });
            }
        }
    }

    render() {
        return (
            <div>
                {this.props.channels.map((c) =>
                    this.ChannelListItem(this.props, c, c == this.state.currentSelected?.name)
                )}
            </div>
        );
    }

    ChannelListItem(props: ChannelListProps, name: string, isSelected: boolean) {
        const selected = isSelected ? " bg-[#404248] text-[#fff]" : "";
        return (
            <div
                class={`m-1 pl-1
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

const selectChannel = (emit: emitFunc<SelectChannel>, name: string) => () => {
    return emit({
        type: "SelectChannel",
        name,
    });
};
