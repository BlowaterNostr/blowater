import { Component, h } from "https://esm.sh/preact@10.17.1";
import { setState } from "./nav.tsx";

type Props = {
    channels: string[];
};

type State = {
    selectedChannel: string | undefined;
};

export class ChannelList extends Component<Props, State> {
    render() {
        return (
            <div class="border w-32 bg-[rgb(242,243,245)]">
                {this.props.channels.map((c) => this.ChannelListItem(c, c == this.state.selectedChannel))}
            </div>
        );
    }

    ChannelListItem(name: string, isSelected: boolean) {
        const selected = isSelected ? " bg-[rgb(214,216,220)]" : "";
        return (
            <div
                class={`border m-1 pl-1
                hover:bg-[rgb(214,216,220)]
                hover:cursor-pointer` + selected}
                onClick={onChannelSelected(this, name)}
            >
                # {name}
            </div>
        );
    }
}

const onChannelSelected = (channelList: ChannelList, channel: string) => async () => {
    await setState(channelList, {
        selectedChannel: channel,
    });
};
