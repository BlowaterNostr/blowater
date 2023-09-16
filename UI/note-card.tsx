/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { ProfileData } from "../features/profile.ts";
import { Avatar } from "./components/avatar.tsx";
import { HoverButtonBackgroudColor, PrimaryTextColor } from "./style/colors.ts";
import { emitFunc } from "../event-bus.ts";
import { ViewNoteThread } from "./message-panel.tsx";
import { DirectedMessage_Event, Text_Note_Event } from "../nostr.ts";

export function NoteCard(props: {
    profileData?: ProfileData;
    event: Text_Note_Event | DirectedMessage_Event;
    emit: emitFunc<ViewNoteThread>;
}) {
    const { profileData, event, emit } = props;
    const styles = {
        container:
            tw`px-4 my-1 py-2 border-2 text-[${PrimaryTextColor}] border-[${PrimaryTextColor}4D] rounded-lg py-1 flex cursor-pointer bg-[#36393F] hover:bg-[${HoverButtonBackgroudColor}]`,
        avatar: tw`w-10 h-10`,
        information: {
            container: tw`ml-2 flex-1 overflow-hidden`,
            name: tw`truncate`,
            content: tw`text-[0.8rem]`,
        },
    };

    const onClick = () => {
        emit({
            type: "ViewNoteThread",
            event: event,
        });
    };

    const content = "decryptedContent" in event
        ? (event as DirectedMessage_Event).decryptedContent
        : event.content;

    return (
        <div class={styles.container} onClick={onClick}>
            <Avatar class={styles.avatar} picture={profileData?.picture} />
            <div class={styles.information.container}>
                <p class={styles.information.name}>
                    {profileData?.name || event.publicKey.bech32()}
                </p>
                <p class={styles.information.content}>{content}</p>
            </div>
        </div>
    );
}
