/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { HoverButtonBackgroudColor } from "../style/colors.ts";

export function Loading() {
    return (
        <div class={tw`w-full mt-8}`}>
            <div class={tw`animate-pulse flex`}>
                <div class={tw`flex-1 space-y-4 py-1`}>
                    <div class={tw`h-4 bg-[${HoverButtonBackgroudColor}] rounded w-1/2`}></div>
                    <div class={tw`h-4 bg-[${HoverButtonBackgroudColor}] rounded w-3/4`}></div>
                    <div class={tw`h-4 bg-[${HoverButtonBackgroudColor}] rounded w-5/6`}></div>
                </div>
            </div>
        </div>
    );
}
