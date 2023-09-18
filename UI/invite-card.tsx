/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { PrimaryTextColor, SecondaryBackgroundColor, SecondaryTextColor } from "./style/colors.ts";
import { Avatar } from "./components/avatar.tsx";
import { LinearGradientsClass, NoOutlineClass } from "./components/tw.ts";

export function InviteCard(props: {
    picture?: string;
    name: string;
    description: string;
    onJoin: () => void;
}) {
    const { picture, name, description, onJoin } = props;

    const styles = {
        container: tw`bg-[${SecondaryBackgroundColor}] rounded-sm p-2 max-w-sm my-1`,
        title: tw`text-[${SecondaryTextColor}] font-bold text-xs uppercase`,
        profile: {
            container: tw`flex py-2 gap-x-4`,
            picture: tw`w-10 h-10`,
            text: {
                container: tw`flex-1 overflow-hidden`,
                name: tw`text-[${PrimaryTextColor}] truncate`,
                description: tw`text-[${SecondaryTextColor}] text-xs truncate`,
            },
        },
        button:
            tw`px-4 py-2 rounded-sm ${LinearGradientsClass} hover:bg-gradient-to-l text-[${PrimaryTextColor}] text-sm ${NoOutlineClass} font-bold`,
    };

    return (
        <div class={styles.container}>
            <p class={styles.title}>Please join me on group chat</p>
            <div class={styles.profile.container}>
                <Avatar picture={picture} class={styles.profile.picture} />
                <div class={styles.profile.text.container}>
                    <h3 class={styles.profile.text.name}>{name}</h3>
                    <p class={styles.profile.text.description}>{description}</p>
                </div>
                <button class={styles.button} onClick={onJoin}>Join</button>
            </div>
        </div>
    );
}
