/** @jsx h */
import { Component, h } from "https://esm.sh/preact@10.17.1";

import { InviteIcon } from "./icons/invite-icon.tsx";
import { DividerBackgroundColor, HoverButtonBackgroudColor, PrimaryTextColor } from "./style/colors.ts";
import { NoOutlineClass } from "./components/tw.ts";
import { GroupMessageController } from "../features/gm.ts";
import { ProfileGetter } from "./search.tsx";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { emitFunc } from "../event-bus.ts";

type State = {
    show: boolean;
};

type Props = {
    userPublicKey: PublicKey;
    groupChatController: GroupMessageController;
    profileGetter: ProfileGetter;
    emit: emitFunc<InviteUsersToGroup>;
};

export type InviteUsersToGroup = {
    type: "InviteUsersToGroup";
    groupPublicKey: PublicKey;
    usersPublicKey: PublicKey[];
};

export class InviteButton extends Component<Props, State> {
    state = { show: false };
    styles = {
        button: {
            container:
                `w-6 h-6 flex items-center justify-center relative bg-[${DividerBackgroundColor}] hover:[${HoverButtonBackgroudColor}] ${NoOutlineClass}`,
            icon: `w-4 h-4 scale-150 fill-current text-[${PrimaryTextColor}]`,
        },
        ul: `absolute top-6 rounded right-0 text-[${PrimaryTextColor}] bg-[${HoverButtonBackgroudColor}] z-20 overflow-y-auto`,
        li: `p-2 text-left hover:bg-[${DividerBackgroundColor}] first:rounded-t last:rounded-b w-32 whitespace-nowrap truncate text-xs`,
    };

    sendEvent = (e: h.JSX.TargetedMouseEvent<HTMLLIElement>, groupPublicKey: PublicKey) => {
        e.stopPropagation();
        this.setState({
            show: false,
        });

        this.props.emit({
            type: "InviteUsersToGroup",
            groupPublicKey: groupPublicKey,
            usersPublicKey: [this.props.userPublicKey],
        });
    };

    render() {
        const { groupChatController, profileGetter } = this.props;

        return (
            <button
                class={this.styles.button.container}
                onBlur={() => {
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
                            {groupChatController.getConversationList().length > 0
                                ? groupChatController.getConversationList().map((group) => {
                                    return (
                                        <li
                                            class={this.styles.li}
                                            onClick={(e) => this.sendEvent(e, group.pubkey)}
                                        >
                                            {profileGetter.getProfilesByPublicKey(group.pubkey)?.profile
                                                .name || group.pubkey.bech32()}
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
