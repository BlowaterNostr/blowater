/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DirectMessagePanelUpdate, MessagePanel } from "./message-panel.tsx";
import { Model } from "./app_model.ts";
import { NostrAccountContext } from "https://raw.githubusercontent.com/BlowaterNostr/nostr.ts/main/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { EventEmitter } from "../event-bus.ts";
import { AllUsersInformation, ProfilesSyncer } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { PrimaryTextColor } from "./style/colors.ts";
import { EditorEvent } from "./editor.tsx";
import { PinContact, UnpinContact } from "../nostr.ts";

export type SocialUpdates = SocialFilterChanged_content | SocialFilterChanged_authors;

type SocialFilterChanged_content = {
    type: "SocialFilterChanged_content";
    content: string;
};

type SocialFilterChanged_authors = {
    type: "SocialFilterChanged_authors";
    authors: string;
};

export function SocialPanel(props: {
    focusedContent: any;
    model: Model;
    ctx: NostrAccountContext;
    db: Database_Contextual_View;
    eventEmitter: EventEmitter<
        SocialUpdates | EditorEvent | DirectMessagePanelUpdate | PinContact | UnpinContact
    >;
    profileSyncer: ProfilesSyncer;
    eventSyncer: EventSyncer;
    allUsersInfo: AllUsersInformation;
}) {
    const model = props.model;

    const messages = [];
    for (const thread of model.social.threads) {
        if (!thread.root.content.toLowerCase().includes(model.social.filter.content.toLowerCase())) {
            continue;
        }
        if (!thread.root.author.name?.toLowerCase().includes(model.social.filter.author.toLowerCase())) {
            continue;
        }
        messages.push(thread);
    }

    return (
        <div
            class={tw`flex-1 overflow-hidden flex-col flex bg-[#313338]`}
        >
            <div class={tw`flex-col text-[${PrimaryTextColor}] ml-5 my-3`}>
                <p>Filter</p>
                <div class={tw`flex`}>
                    <div class={tw`flex`}>
                        <p class={tw`mr-3`}>Content</p>
                        <input
                            class={tw`text-black`}
                            onInput={(e) => {
                                props.eventEmitter.emit({
                                    type: "SocialFilterChanged_content",
                                    content: e.currentTarget.value,
                                });
                            }}
                        >
                        </input>
                    </div>
                    <div class={tw`flex ml-3`}>
                        <p class={tw`mr-3`}>Author</p>
                        <input
                            class={tw`text-black`}
                            onInput={(e) => {
                                props.eventEmitter.emit({
                                    type: "SocialFilterChanged_authors",
                                    authors: e.currentTarget.value,
                                });
                            }}
                        >
                        </input>
                    </div>
                </div>
            </div>
            <div class={tw`flex-1 overflow-x-auto`}>
                <MessagePanel
                    focusedContent={props.focusedContent}
                    editorModel={model.social.editor}
                    myPublicKey={props.ctx.publicKey}
                    messages={messages}
                    rightPanelModel={model.rightPanelModel}
                    db={props.db}
                    eventEmitter={props.eventEmitter}
                    profilesSyncer={props.profileSyncer}
                    eventSyncer={props.eventSyncer}
                    allUserInfo={props.allUsersInfo.userInfos}
                />
            </div>
        </div>
    );
}
