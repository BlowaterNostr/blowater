/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { PrimaryTextColor, SecondaryBackgroundColor, TitleIconColor } from "./style/colors.ts";
import { GroupIcon } from "./icons/group-icon.tsx";
import { emitFunc } from "../event-bus.ts";
import { ProfileGetter } from "./search.tsx";
import { EditProfile, SaveProfile } from "./edit-profile.tsx";
import { NostrAccountContext } from "../../0_lib/nostr-ts/nostr.ts";

export type StartEditGroupChatProfile = {
    type: "StartEditGroupChatProfile";
    ctx: NostrAccountContext;
};

export function EditGroup(props: {
    ctx: NostrAccountContext;
    profileGetter: ProfileGetter;
    emit: emitFunc<SaveProfile>;
}) {
    const styles = {
        container: `py-6 px-4 bg-[${SecondaryBackgroundColor}]`,
        header: {
            container: `text-[${PrimaryTextColor}] text-xl flex`,
            icon: `w-8 h-8 mr-4 text-[${TitleIconColor}] fill-current`,
        },
    };

    return (
        <div class={styles.container}>
            <p class={styles.header.container}>
                <GroupIcon class={styles.header.icon} />
                Update Group
            </p>
            <EditProfile ctx={props.ctx} profileGetter={props.profileGetter} emit={props.emit} />
        </div>
    );
}
