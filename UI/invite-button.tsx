/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { InviteIcon } from "./icons2/invite-icon.tsx";
import { DividerBackgroundColor, HoverButtonBackgroudColor, PrimaryTextColor } from "./style/colors.ts";
import { NoOutlineClass } from "./components/tw.ts";
import { ConversationSummary } from "./conversation-list.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";

type State = {
    show: boolean;
};

type Props = {
    groupChat: ConversationSummary[];
    targetPublicKey: PublicKey;
};

export class InviteButton extends Component<Props, State> {
    state = { show: false };
    styles = {
        button: {
            container:
                tw`w-6 h-6 flex items-center justify-center relative bg-[${DividerBackgroundColor}] hover:[${HoverButtonBackgroudColor}] ${NoOutlineClass}`,
            icon: tw`w-4 h-4 scale-150 fill-current text-[${PrimaryTextColor}]`,
        },
        ul: tw`absolute top-6 rounded right-[-3rem] text-[${PrimaryTextColor}] bg-[${HoverButtonBackgroudColor}] z-20 overflow-y-auto`,
        li: tw`p-2 text-left hover:bg-[${DividerBackgroundColor}] first:rounded-t last:rounded-b w-32 whitespace-nowrap truncate text-xs`,
    };

    sendEvent = (groupPubKey: ConversationSummary) => {
        console.log(groupPubKey, this.props.targetPublicKey);
    };

    render() {
        const { groupChat } = this.props;

        return (
            <button
                class={this.styles.button.container}
                onMouseLeave={() => {
                    this.setState({
                        show: false,
                    });
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    this.setState({
                        show: true,
                    });
                }}
            >
                <InviteIcon class={this.styles.button.icon} />
                {this.state.show
                    ? (
                        <ul
                            class={this.styles.ul}
                            style={{
                                boxShadow: "2px 2px 5px 0 black",
                                maxHeight: "20rem",
                            }}
                        >
                            {groupChat.length > 0
                                ? groupChat.map((group) => {
                                    return (
                                        <li
                                            class={this.styles.li}
                                            onClick={() => this.sendEvent(group)}
                                        >
                                            {group.profile?.profile.name || group.pubkey}
                                        </li>
                                    );
                                })
                                : <li class={this.styles.li}>No Group</li>}
                        </ul>
                    )
                    : undefined}
            </button>
        );
    }
}
