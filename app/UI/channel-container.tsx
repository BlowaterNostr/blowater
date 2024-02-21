import { Component, h } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";
import { MessageList } from "./message-panel.tsx";
import { emitFunc } from "../event-bus.ts";
import { SingleRelayConnection } from "../../libs/nostr.ts/relay-single.ts";
import { EventGetter } from "../database.ts";
import { NostrEvent, NostrKind } from "../../libs/nostr.ts/nostr.ts";

interface Kind1Getter {
    getEvents(relay: string): NostrEvent<NostrKind.TEXT_NOTE>[];
}

type ChannelContainerProps = {
    relay: SingleRelayConnection;
    kind1Getter: Kind1Getter;
};

export class ChannelContainer extends Component<ChannelContainerProps> {
    render() {
        return (
            <div class="flex flex-row">
                <ChannelList channels={["general"]}></ChannelList>
                <ChannelMessagePanel></ChannelMessagePanel>
            </div>
        );
    }
}

type ChannelMessagePanelProps = {};

class ChannelMessagePanel extends Component<ChannelMessagePanelProps> {
    render(props: ChannelMessagePanelProps) {
        return (
            <div>
                ChannelMessagePanel
            </div>
        );
    }
}
