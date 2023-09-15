/** @jsx h */
import { Component } from "https://esm.sh/preact@10.17.1";
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { emitFunc } from "../event-bus.ts";
import { ProfileData } from "../features/profile.ts";
import { PublicKey } from "../lib/nostr-ts/key.ts";
import { Avatar } from "./components/avatar.tsx";
import { DividerClass } from "./components/tw.ts";
import { ViewUserDetail } from "./message-panel.tsx";
import { HoverButtonBackgroudColor, PrimaryTextColor } from "./style/colors.ts";

type Props = {
    profileData?: ProfileData;
    publicKey: PublicKey;
    emit: emitFunc<ViewUserDetail>;
};

export class ProfileCard extends Component<Props, {}> {
    styles = {
        container:
            tw`px-4 py-2 my-1 border-2 border-[${PrimaryTextColor}4D] rounded-lg hover:bg-[${HoverButtonBackgroudColor}] cursor-pointer py-1`,
        profile: {
            container: tw`flex`,
            avatar: tw`w-10 h-10`,
            name: tw`text-[1.2rem] font-blod leading-10 truncate ml-2`,
        },
        divider: tw`${DividerClass} my-[0.5rem]`,
        about: tw`text-[0.8rem]`,
    };

    onClick = () => {
        this.props.emit({
            type: "ViewUserDetail",
            pubkey: this.props.publicKey,
        });
    };

    render() {
        const { publicKey, profileData } = this.props;

        return (
            <div class={this.styles.container} onClick={this.onClick}>
                <div class={this.styles.profile.container}>
                    <Avatar class={this.styles.profile.avatar} picture={profileData?.picture}></Avatar>
                    <p class={this.styles.profile.name}>
                        {profileData?.name || publicKey.bech32()}
                    </p>
                </div>
                <div class={this.styles.divider}></div>
                <p class={this.styles.about}>{profileData?.about}</p>
            </div>
        );
    }
}
