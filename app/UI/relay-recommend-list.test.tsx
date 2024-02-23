/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { RelayRecommendList } from "./relay-recommend-list.tsx";

render(
    <div
        class={`flex flex-col justify-center items-centeh-[80%] absolute top-[20%] overflow-auto bg-[#27272A] w-full shadow-inner`}
    >
        <RelayRecommendList />
    </div>,
    document.body,
);
