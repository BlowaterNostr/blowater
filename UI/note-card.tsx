/** @jsx h */
import { Component } from "https://esm.sh/preact@10.11.3";
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { ProfileData } from "../features/profile.ts";
import { Avatar } from "./components/avatar.tsx";
import { HoverButtonBackgroudColor, PrimaryTextColor } from "./style/colors.ts";
import { emitFunc } from "../event-bus.ts";
import { ViewNoteThread } from "./message-panel.tsx";
import { Parsed_Event } from "../nostr.ts";

type Props = {
    profileData?: ProfileData;
    event: Parsed_Event;
    emit: emitFunc<ViewNoteThread>;
};

export class NoteCard extends Component<Props, {}> {
    styles = {
        container:
            tw`px-4 my-1 py-2 border-2 border-[${PrimaryTextColor}4D] rounded-lg py-1 flex cursor-pointer hover:bg-[${HoverButtonBackgroudColor}]`,
        avatar: tw`w-10 h-10`,
        information: {
            container: tw`ml-2 flex-1 overflow-hidden`,
            name: tw`truncate`,
            content: tw`text-[0.8rem]`,
        },
    };

    onClick = () => {
        this.props.emit({
            type: "ViewNoteThread",
            event: this.props.event,
        });
    };

    render() {
        const { profileData, event } = this.props;

        return (
            <div class={this.styles.container} onClick={this.onClick}>
                <Avatar class={this.styles.avatar} picture={profileData?.picture} />
                <div class={this.styles.information.container}>
                    <p class={this.styles.information.name}>
                        {profileData?.name || event.publicKey.bech32()}
                    </p>
                    <p class={this.styles.information.content}>{event.content}</p>
                </div>
            </div>
        );
    }
}
