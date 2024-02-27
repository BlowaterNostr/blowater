import { Component, h } from "https://esm.sh/preact@10.17.1";
import { setState } from "./_helper.ts";
import { SelectChannel } from "./search_model.ts";
import { UI_Interaction_Event } from "./app_update.tsx";
import { emitFunc, EventSubscriber } from "../event-bus.ts";

type ChannelListProps = {
    relay: string;
    relaySelectedChannel: Map<string, string>;
    emit: emitFunc<SelectChannel>;
    eventSub: EventSubscriber<UI_Interaction_Event>;
    channels: string[];
};

type ChannelListState = {
    currentSelected: string | undefined;
};

export class ChannelList extends Component<ChannelListProps, ChannelListState> {
    state: Readonly<ChannelListState> = {
        currentSelected: this.initialSelected(),
    };

    initialSelected() {
        return this.props.relaySelectedChannel.get(this.props.relay);
    }

    async componentDidMount() {
        for await (const e of this.props.eventSub.onChange()) {
            if (e.type == "SelectChannel") {
                await setState(this, {
                    currentSelected: e.channel,
                });
            } else if (e.type == "SelectRelay") {
                await setState(this, {
                    currentSelected: this.props.relaySelectedChannel.get(e.relay.url),
                });
            }
        }
    }

    render() {
        return (
            <div>
                {this.props.channels.map((c) =>
                    this.ChannelListItem(this.props, c, c == this.state.currentSelected)
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
                    props.relay,
                    name,
                )}
            >
                # {name}
            </div>
        );
    }
}

const selectChannel = (emit: emitFunc<SelectChannel>, relay: string, channel: string) => () => {
    return emit({
        type: "SelectChannel",
        relay,
        channel,
    });
};
