/** @jsx h */
import { Fragment, h } from "https://esm.sh/preact@10.11.3";
import { CenterClass, InputClass } from "./components/tw.ts";
import { PrimaryTextColor, SecondaryBackgroundColor, TitleIconColor } from "./style/colors.ts";
import { Component } from "https://esm.sh/preact@10.11.3";
import { AboutIcon } from "./icons/about-icon.tsx";
import { CopyButton } from "./components/copy-button.tsx";

export type EventDetailItem = {
    title: string;
    fields: string[];
};

type Props = {
    items: EventDetailItem[];
};

export class EventDetail extends Component<Props> {
    styles = {
        header: {
            container: `text-[${PrimaryTextColor}] text-xl flex`,
            icon: `w-8 h-8 mr-4 text-[${TitleIconColor}]`,
        },
        title: `mt-7 text-[${PrimaryTextColor}]`,
        field: {
            container: `relative ${InputClass} resize-none flex p-0 mt-4`,
            pre: `whitespace-pre flex-1 overflow-x-auto px-4 py-3`,
            copyButton: `w-14 ${CenterClass}`,
        },
    };

    render() {
        return (
            <div class={`h-full overflow-auto py-6 px-4 bg-[${SecondaryBackgroundColor}]`}>
                <p class={this.styles.header.container}>
                    <AboutIcon class={this.styles.header.icon} />
                    Details
                </p>

                {this.props.items.map((item) => (
                    <Fragment>
                        <p class={this.styles.title}>{item.title}</p>
                        {item.fields.map((field) => (
                            <div class={this.styles.field.container}>
                                <pre class={this.styles.field.pre}>{field}</pre>
                                <div class={this.styles.field.copyButton}>
                                    <CopyButton text={field} />
                                </div>
                            </div>
                        ))}
                    </Fragment>
                ))}
            </div>
        );
    }
}
