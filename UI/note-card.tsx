/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { ProfileData } from "../features/profile.ts";
import {
    cardBackgroundColor,
    HintLinkColor,
    HintTextColor,
    LinkColor,
    PrimaryTextColor,
} from "./style/colors.ts";
import { emitFunc } from "../event-bus.ts";
import { OpenNote, ViewUserDetail } from "./message-panel.tsx";
import { NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";

export function NoteCard(props: {
    profileData?: ProfileData;
    event: NostrEvent;
    emit: emitFunc<OpenNote | ViewUserDetail>;
    publicKey: PublicKey;
}) {
    const { profileData, event, emit, publicKey } = props;
    const styles = {
        container:
            tw`px-4 mb-1 mobile:px-2 py-1 text-[${PrimaryTextColor}] rounded bg-[${cardBackgroundColor}] border-l-2 border-[${HintLinkColor}] w-4/5 mobile:w-full`,
        name: tw`truncate font-bold text-[${LinkColor}] text-base cursor-pointer hover:underline`,
        content: tw`text-sm text-[${HintTextColor}] hover:underline cursor-pointer`,
    };

    const viewNoteDetail = () =>
        emit({
            type: "OpenNote",
            event: event,
        });

    const viewUserDetail = () => {
        emit({
            type: "ViewUserDetail",
            pubkey: publicKey,
        });
    };

    const content = event.content.slice(0, 200);

    return (
        <div class={styles.container}>
            <p class={styles.name} onClick={viewUserDetail}>
                {profileData?.name || publicKey.bech32()}
            </p>
            <p onClick={viewNoteDetail} class={styles.content}>
                {content}
                {event.content.length > 200 ? "..." : ""}
            </p>
        </div>
    );
}
