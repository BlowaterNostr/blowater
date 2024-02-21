import { Component, h } from "https://esm.sh/preact@10.17.1";

type Props = {
    channels: string[];
};

type State = {};

export class ChannelList extends Component<Props, State> {
    render() {
        return (
            <div>
                {this.props.channels.map((c) => ChannelListItem(c))}
            </div>
        );
    }
}

function ChannelListItem(name: string) {
    return <div># {name}</div>;
}
