/** @jsx h */
import { FunctionComponent, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { Avatar } from "./components/avatar.tsx";

type AppListItem = {
    picture?: string;
    title: string;
    subTitle: string;
    url: string;
};

const AppListData: AppListItem[] = [
    {
        picture: "https://info.coracle.social/images/logo.png",
        title: "Coracle",
        subTitle: "Escape the walled gardens and make social media work for you.",
        url: "https://app.coracle.social",
    },
    {
        picture: "https://getalby.com/alby_icon_yellow_128x128.png",
        title: "Alby",
        subTitle: "Your Bitcoin & Nostr companion for the web.",
        url: "https://getalby.com",
    },
    {
        title: "Habla",
        subTitle: "Habla is a nostr-based web app that enables anyone to earn from their writing.",
        url: "https://habla.news/",
    },
    {
        picture: "https://flycat.club/logo512.png",
        title: "Flycat",
        subTitle: "A Nostr blogging client",
        url: "https://flycat.club/",
    },
];

export const AppList: FunctionComponent = () => {
    return (
        <div class={tw`max-w-[40rem] m-auto px-4 py-8`}>
            <ul class={tw`overflow-auto flex-1 p-2 text-[#96989D]`}>
                {AppListData.map((item) => (
                    <li
                        class={tw`cursor-pointer p-2 hover:bg-[#3C3F45] bg-[#36393F] my-2 rounded-lg flex items-center w-full`}
                        onClick={() => {
                            open(item.url);
                        }}
                    >
                        <Avatar
                            class={tw`w-8 h-8 mr-2`}
                            picture={item.picture}
                        />
                        <div class={tw`flex-1 overflow-hidden`}>
                            <p class={tw`w-full text-[1.2rem] text-[#F7F7F7] font-bold`}>
                                {item.title}
                            </p>
                            <p class={tw`w-full`}>
                                {item.subTitle}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
