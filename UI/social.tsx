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

export type SocialUpdates = SocialFilterChanged;

type SocialFilterChanged = {
    type: "SocialFilterChanged";
    filter: string;
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
        if (thread.root.content.includes(model.social.filter)) {
            messages.push(thread);
        }
    }

    return (
        <div
            class={tw`flex-1 overflow-hidden bg-[#313338]`}
        >
            <div class={tw`text-[${PrimaryTextColor}] flex`}>
                <p>Filter</p>
                <input
                    class={tw`text-black`}
                    onInput={(e) => {
                        props.eventEmitter.emit({
                            type: "SocialFilterChanged",
                            filter: e.currentTarget.value,
                        });
                    }}
                >
                </input>
            </div>
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
    );
}
