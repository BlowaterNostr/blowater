/** @jsx h */
import { h } from "https://esm.sh/preact@10.11.3";
import { tw } from "https://esm.sh/twind@0.16.16";
import { DirectMessagePanelUpdate, MessagePanel } from "./message-panel.tsx";
import { Model } from "./app_model.ts";
import { NostrAccountContext } from "../lib/nostr-ts/nostr.ts";
import { Database_Contextual_View } from "../database.ts";
import { EventEmitter } from "../event-bus.ts";
import { AllUsersInformation, getUserInfoFromPublicKey, ProfilesSyncer } from "./contact-list.ts";
import { EventSyncer } from "./event_syncer.ts";
import { PrimaryTextColor } from "./style/colors.ts";
import { EditorEvent } from "./editor.tsx";
import { PinContact, UnpinContact } from "../nostr.ts";
import { CenterClass, LinearGradientsClass } from "./components/tw.ts";

export type SocialUpdates =
    | SocialFilterChanged_content
    | SocialFilterChanged_authors
    | SocialFilterChanged_adding_author
    | SocialFilterChanged_remove_author;

type SocialFilterChanged_content = {
    type: "SocialFilterChanged_content";
    content: string;
};

type SocialFilterChanged_authors = {
    type: "SocialFilterChanged_authors";
};

type SocialFilterChanged_adding_author = {
    type: "SocialFilterChanged_adding_author";
    value: string;
};

type SocialFilterChanged_remove_author = {
    type: "SocialFilterChanged_remove_author";
    value: string;
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
    const t = Date.now();
    const model = props.model;

    const messages = [];
    // todo: can move this logic to update to speed up
    for (const thread of model.social.threads) {
        // content
        if (!thread.root.content.toLowerCase().includes(model.social.filter.content.toLowerCase())) {
            continue;
        }

        // authors
        let matched_at_least_one_author = false;
        for (const author of model.social.filter.author) {
            const userInfo = getUserInfoFromPublicKey(
                thread.root.event.publicKey,
                props.allUsersInfo.userInfos,
            );
            if (userInfo && userInfo.profile?.profile.name?.toLowerCase().includes(author.toLowerCase())) {
                matched_at_least_one_author = true;
                break;
            }
        }
        if (model.social.filter.author.size > 0 && !matched_at_least_one_author) {
            continue;
        }

        messages.push(thread);
    }
    console.log("SocialPanel:filter threads", Date.now() - t, model.social.threads.length);

    const messagePanel = (
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
    );
    console.log("SocialPanel:MessagePanel", Date.now() - t);

    return (
        <div
            class={tw`flex-1 overflow-hidden flex-col flex bg-[#313338]`}
        >
            {Filter(props)}
            <div class={tw`flex-1 overflow-x-auto`}>
                {messagePanel}
            </div>
        </div>
    );
}

function Filter(
    props: {
        eventEmitter: EventEmitter<SocialUpdates>;
        model: Model;
    },
) {
    const authors = [];
    for (const author of props.model.social.filter.author) {
        authors.push(
            <div class={tw`flex mx-1 border border-indigo-600`}>
                <p class={tw`mx-1`}>
                    {author}
                </p>
                <button
                    class={tw`text-[${PrimaryTextColor}] rounded-lg ${CenterClass} bg-[#36393F] hover:bg-transparent font-bold`}
                    onClick={(e) => {
                        props.eventEmitter.emit({
                            type: "SocialFilterChanged_remove_author",
                            value: author,
                        });
                    }}
                >
                    X
                </button>
            </div>,
        );
    }

    return (
        <div class={tw`flex-col text-[${PrimaryTextColor}] ml-5 my-3`}>
            <p>Filter</p>
            <div class={tw`flex-col`}>
                <div class={tw`flex flex-wrap`}>
                    <p class={tw`mr-3`}>Content</p>
                    <input
                        class={tw`text-black`}
                        onInput={(e) => {
                            props.eventEmitter.emit({
                                type: "SocialFilterChanged_content",
                                content: e.currentTarget.value,
                            });
                        }}
                        value={props.model.social.filter.content}
                    >
                    </input>
                </div>
                <div class={tw`flex  flex-wrap mt-3`}>
                    <p class={tw`mr-3`}>Authors</p>
                    {authors}
                    <input
                        class={tw`text-black`}
                        onInput={(e) => {
                            props.eventEmitter.emit({
                                type: "SocialFilterChanged_adding_author",
                                value: e.currentTarget.value,
                            });
                        }}
                        value={props.model.social.filter.adding_author}
                    >
                    </input>
                    <div
                        class={tw`ml-3 rounded-lg ${LinearGradientsClass}`}
                    >
                        <button
                            class={tw`w-[4.8rem] text-[${PrimaryTextColor}] rounded-lg ${CenterClass} bg-[#36393F] hover:bg-transparent font-bold`}
                            onClick={(e) => {
                                props.eventEmitter.emit({
                                    type: "SocialFilterChanged_authors",
                                });
                            }}
                        >
                            Add
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
