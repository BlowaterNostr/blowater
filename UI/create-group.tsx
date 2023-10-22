/** @jsx h */
import { Component } from "https://esm.sh/preact@10.17.1";
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { ErrorColor, PrimaryTextColor, SecondaryBackgroundColor, TitleIconColor } from "./style/colors.ts";
import { GroupIcon } from "./icons2/group-icon.tsx";
import { ButtonClass, InputClass, LinearGradientsClass } from "./components/tw.ts";
import { Avatar } from "./components/avatar.tsx";
import { ProfileData } from "../features/profile.ts";
import { emitFunc } from "../event-bus.ts";

export type StartCreateGroupChat = {
    type: "StartCreateGroupChat";
};

export type CreateGroupChat = {
    type: "CreateGroupChat";
    profileData: ProfileData;
};

type Props = {
    emit: emitFunc<CreateGroupChat>;
};

type State = {
    name: string;
    picture: string;
    error: string;
};

export class CreateGroup extends Component<Props, State> {
    state = {
        name: "",
        picture: "",
        error: "",
    };
    styles = {
        container: tw`py-6 px-4 bg-[${SecondaryBackgroundColor}]`,
        header: {
            container: tw`text-[${PrimaryTextColor}] text-xl flex`,
            icon: tw`w-8 h-8 mr-4 text-[${TitleIconColor}] fill-current`,
        },
        title: tw`mt-7 text-[${PrimaryTextColor}]`,
        avatar: tw`w-14 h-14 m-auto`,
        input: tw`${InputClass} mt-4`,
        error: tw`mt-2 text-[${ErrorColor}] text-xs`,
        submit:
            tw`w-full mt-4 ${ButtonClass} ${LinearGradientsClass} hover:bg-gradient-to-l disabled:opacity-50`,
    };

    onNameInput = (name: string) => {
        this.setState({
            name: name,
        });

        if (name.trim()) {
            this.setState({
                error: "",
            });
        }
    };

    onPictureInput = (picture: string) => {
        this.setState({
            picture: picture,
        });
    };

    onSubmit = async () => {
        const name = this.state.name.trim();
        if (!name) {
            this.setState({
                error: "Name is required.",
            });
            return;
        }

        this.props.emit({
            type: "CreateGroupChat",
            profileData: {
                name: name,
                picture: this.state.picture,
            },
        });
    };

    error = () => {
        if (this.state.error) {
            return <p class={this.styles.error}>{this.state.error}</p>;
        }

        return undefined;
    };

    render() {
        return (
            <div class={this.styles.container}>
                <p class={this.styles.header.container}>
                    <GroupIcon class={this.styles.header.icon} />
                    Create Group
                </p>
                <Avatar picture={this.state.picture} class={this.styles.avatar} />
                <p class={this.styles.title}>Group Name</p>
                <input
                    onInput={(e) => this.onNameInput(e.currentTarget.value)}
                    type="text"
                    class={this.styles.input}
                />
                {this.error()}

                <p class={this.styles.title}>Picture</p>
                <input
                    onInput={(e) => this.onPictureInput(e.currentTarget.value)}
                    type="text"
                    class={this.styles.input}
                />

                <button class={this.styles.submit} onClick={this.onSubmit}>
                    Create
                </button>
            </div>
        );
    }
}
