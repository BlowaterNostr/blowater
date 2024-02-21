import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { MessagePanel } from "./message-panel.tsx";

export class ChannelContainer extends Component {
    render() {
        return (
            <div class="flex flex-row">
                <ChannelList channels={["general"]}></ChannelList>
                <ChannelMessagePanel></ChannelMessagePanel>
            </div>
        );
    }
}

class ChannelMessagePanel extends Component {
    render() {
        return <div>ChannelMessagePanel</div>;
    }
}
