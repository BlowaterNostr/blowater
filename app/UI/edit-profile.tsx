import { createRef, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { ProfileData } from "../features/profile.ts";
import { Component, ComponentChildren } from "https://esm.sh/preact@10.11.3";
import { emitFunc } from "../event-bus.ts";
import { NostrAccountContext } from "../../libs/nostr.ts/nostr.ts";

export type SaveProfile = {
    type: "SaveProfile";
    profile: ProfileData | undefined;
    ctx: NostrAccountContext;
};

type profileItem = {
    key: string;
    value?: string;
    hint?: ComponentChildren;
};

type Props = {
    ctx: NostrAccountContext;
    profile: ProfileData;
    emit: emitFunc<SaveProfile>;
};

type State = {
    profileData: ProfileData | undefined;
    newFieldKeyError: string;
};

export class EditProfile extends Component<Props, State> {
    state: Readonly<State> = {
        newFieldKeyError: "",
        profileData: undefined,
    };

    componentDidMount(): void {
        this.setState({
            profileData: this.props.profile,
        });
    }

    render() {
        const profileItems: profileItem[] = [
            {
                key: "name",
                value: this.state.profileData?.name,
            },
            {
                key: "banner",
                value: this.state.profileData?.banner,
            },
            {
                key: "picture",
                value: this.state.profileData?.picture,
                hint: (
                    <span class="text-sm text-hint-text">
                        You can upload your images on websites like{" "}
                        <a class={"text-hint-link"} href="https://nostr.build/" target="_blank">
                            nostr.build
                        </a>
                    </span>
                ),
            },
            {
                key: "about",
                value: this.state.profileData?.about,
            },
            {
                key: "website",
                value: this.state.profileData?.website,
            },
        ];

        const items = profileItems.map((item) => (
            <Fragment>
                <h3 class={"text-primary-text mt-8"} style={{ textTransform: "capitalize" }}>
                    {item.key}
                </h3>
                <textarea
                    placeholder={item.key}
                    rows={item.value?.split("\n")?.length || 1}
                    value={item.value}
                    onInput={(e) => this.onInput(e, item.key)}
                    type="text"
                    class={"w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-divider-background  placeholder-placeholder-text text-primary-text"}
                >
                </textarea>
                {item.hint}
            </Fragment>
        ));

        return (
            <div class="py-4 bg-secondary-background">
                {items}

                <div class="h-[0.0625rem] bg-divider-background my-[1.5rem] w-full"></div>
                <p class="text-primary-text font-bold text-sm">Custom Fields</p>
                <span class="text-hint-text text-sm">
                    Create your own custom fields, anything goes!
                </span>

                <h3 class="text-primary-text mt-8">
                    Field name
                </h3>
                <input
                    ref={this.newFieldKey}
                    placeholder="e.g. hobbies"
                    type="text"
                    class={"w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-divider-background  placeholder-placeholder-text text-primary-text"}
                />
                <span class="text-sm text-error">{this.state.newFieldKeyError}</span>

                <h3 class="text-primary-text mt-8">
                    Field value
                </h3>
                <textarea
                    ref={this.newFieldValue}
                    placeholder="e.g. Sports, Reading, Design"
                    rows={1}
                    onInput={(e) => this.onInput(e)}
                    type="text"
                    class={"w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-divider-background  placeholder-placeholder-text text-primary-text"}
                >
                </textarea>

                <button
                    class="w-full mt-6 p-3 rounded-lg focus:outline-none focus-visible:outline-none text-primary-text bg-divider-background hover:bg-hover-button-background flex items-center justify-cente"
                    onClick={this.addField}
                >
                    Add Field
                </button>

                <div class={`h-[0.0625rem] bg-divider-background my-[1.5rem] w-full`}></div>

                <button
                    class="w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none text-primary-text flex items-center justify-cente bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l"
                    onClick={this.onSubmit}
                >
                    Update Profile
                </button>
            </div>
        );
    }

    styles = {
        field: {
            title: `text-primary-text mt-8`,
            input:
                `w-full px-4 py-3 rounded-lg resize-y bg-transparent focus:outline-none focus-visible:outline-none border-[2px] border-divider-background  placeholder-placeholder-text text-primary-text`,
            hint: {
                text: `text-sm text-hint-text`,
                link: `text-hint-link`,
            },
        },
        addButton:
            `w-full mt-6 p-3 rounded-lg focus:outline-none focus-visible:outline-none text-primary-text bg-divider-background hover:bg-hover-button-background flex items-center justify-cente`,
        submitButton:
            `w-full p-3 rounded-lg focus:outline-none focus-visible:outline-none text-primary-text flex items-center justify-cente bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]  hover:bg-gradient-to-l`,
        divider: `h-[0.0625rem] bg-divider-background my-[1.5rem] w-full`,
        custom: {
            title: `text-primary-text font-bold text-sm`,
            text: `text-hint-text text-sm`,
            error: `text-sm text-error`,
        },
    };

    newFieldKey = createRef<HTMLInputElement>();
    newFieldValue = createRef<HTMLTextAreaElement>();

    onInput = (e: h.JSX.TargetedEvent<HTMLTextAreaElement, Event>, key?: string) => {
        const lines = e.currentTarget.value.split("\n");
        e.currentTarget.setAttribute(
            "rows",
            `${lines.length}`,
        );
        if (key) {
            const value = e.currentTarget.value;
            this.setState({
                profileData: {
                    ...this.state.profileData,
                    [key]: value,
                },
            });
        }
    };

    addField = () => {
        if (!this.newFieldKey.current || !this.newFieldValue.current) {
            return;
        }

        if (this.newFieldKey.current.value.trim() == "") {
            this.setState({
                newFieldKeyError: "Key is required.",
            });
            return;
        }

        this.setState({
            profileData: {
                ...this.state.profileData,
                [this.newFieldKey.current.value]: this.newFieldValue.current.value,
            },
            newFieldKeyError: "",
        });

        this.newFieldKey.current.value = "";
        this.newFieldValue.current.value = "";
    };

    onSubmit = () => {
        this.props.emit({
            type: "SaveProfile",
            ctx: this.props.ctx,
            profile: this.state.profileData,
        });
    };
}
