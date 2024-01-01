/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { emitFunc } from "../event-bus.ts";
import { ProfileData } from "../features/profile.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { Avatar } from "./components/avatar.tsx";
import { DividerClass } from "./components/tw.ts";
import { ViewUserDetail } from "./message-panel.tsx";
import { cardBackgroundColor, HintLinkColor, HintTextColor, LinkColor } from "./style/colors.ts";

export function ProfileCard(props: {
    profileData?: ProfileData;
    publicKey: PublicKey;
    emit: emitFunc<ViewUserDetail>;
}) {
    const { profileData, publicKey, emit } = props;
    const styles = {
        container:
            `px-4 mb-1 mobile:px-2 py-1 text-[${HintTextColor}] hover:underline rounded bg-[${cardBackgroundColor}] border-l-2 border-[${HintLinkColor}] max-w-sm cursor-pointer gorup`,
        profile: {
            container: `flex items-center`,
            avatar: `w-8 h-8`,
            name: `text-base font-bold truncate ml-2 text-[${LinkColor}]`,
        },
        divider: `${DividerClass} my-[0.5rem]`,
        about: `text-sm`,
    };

    const onClick = () =>
        emit({
            type: "ViewUserDetail",
            pubkey: publicKey,
        });

    return (
        <div class={styles.container} onClick={onClick}>
            <div class={styles.profile.container}>
                <Avatar class={styles.profile.avatar} picture={profileData?.picture}></Avatar>
                <p class={styles.profile.name}>
                    {profileData?.name || publicKey.bech32()}
                </p>
            </div>
            <div class={styles.divider}></div>
            <p class={styles.about}>{profileData?.about}</p>
        </div>
    );
}
