/** @jsx h */
import { h } from "preact";
import { HoverButtonBackgroundColor } from "../style/colors.ts";

export function Loading() {
    return (
        <div class={`w-full mt-8}`}>
            <div class={`animate-pulse flex`}>
                <div class={`flex-1 space-y-4 py-1`}>
                    <div class={`h-4 bg-[${HoverButtonBackgroundColor}] rounded w-1/2`}></div>
                    <div class={`h-4 bg-[${HoverButtonBackgroundColor}] rounded w-3/4`}></div>
                    <div class={`h-4 bg-[${HoverButtonBackgroundColor}] rounded w-5/6`}></div>
                </div>
            </div>
        </div>
    );
}
