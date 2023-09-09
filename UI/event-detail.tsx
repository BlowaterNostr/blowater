/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { CenterClass, InputClass } from "./components/tw.ts";
import { AboutIcon } from "./icons/about-icon.tsx";
import { PrimaryTextColor, SecondaryBackgroundColor, TitleIconColor } from "./style/colors.ts";
import { OnFocusTransitionButton } from "./components/on-focus-transition-button.tsx";
import { NoteID } from "../lib/nostr-ts/nip19.ts";
import { Component } from "https://esm.sh/preact@10.11.3";
import { NostrEvent } from "../lib/nostr-ts/nostr.ts";
import { Parsed_Event } from "../nostr.ts";

type Props = {
    event: Parsed_Event;
};

type DetailItem = {
    title: string;
    fields: string[];
};

export class PlainTextEventDetail extends Component<Props> {
    styles = {
        container: tw`py-6 px-4 bg-[${SecondaryBackgroundColor}]`,
        header: {
            container: tw`text-[${PrimaryTextColor}] text-xl flex`,
            icon: tw`w-8 h-8 mr-4 text-[${TitleIconColor}] fill-current`,
        },
        title: tw`mt-7 text-[${PrimaryTextColor}]`,
        field: {
            container: tw`relative ${InputClass} resize-none flex p-0 mt-4`,
            pre: tw`whitespace-pre flex-1 overflow-x-auto px-4 py-3`,
            copyButton: tw`w-14 ${CenterClass}`,
        },
    };

    eventID = this.props.event.id;
    eventIDBech32 = NoteID.FromString(this.props.event.id).bech32();
    authorPubkey = this.props.event.publicKey.hex;
    authorPubkeyBech32 = this.props.event.publicKey.bech32();
    content = this.props.event.content;
    originalEventRaw = JSON.stringify(
        {
            content: this.props.event.content,
            created_at: this.props.event.created_at,
            kind: this.props.event.kind,
            tags: this.props.event.tags,
            pubkey: this.props.event.pubkey,
            id: this.props.event.id,
            sig: this.props.event.sig,
        },
        null,
        4,
    );

    items: DetailItem[] = [
        {
            title: "Event ID",
            fields: [
                this.eventID,
                this.eventIDBech32,
            ],
        },
        {
            title: "Author",
            fields: [
                this.authorPubkey,
                this.authorPubkeyBech32,
            ],
        },
        {
            title: "Content",
            fields: [
                this.content,
                this.originalEventRaw,
            ],
        },
    ];

    copy = (text: string) => navigator.clipboard.writeText(text);

    render() {
        return (
            <div class={this.styles.container}>
                <p class={this.styles.header.container}>
                    <AboutIcon class={this.styles.header.icon} />
                    Details
                </p>

                {this.items.map((item) => (
                    <Fragment>
                        <p class={this.styles.title}>{item.title}</p>
                        {item.fields.map((field) => (
                            <div class={this.styles.field.container}>
                                <pre class={this.styles.field.pre}>{field}</pre>
                                <div class={this.styles.field.copyButton}>
                                    <OnFocusTransitionButton onFocus={() => this.copy(field)} />
                                </div>
                            </div>
                        ))}
                    </Fragment>
                ))}
            </div>
        );
    }
}
