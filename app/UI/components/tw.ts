import { DividerBackgroundColor, PlaceholderColor, PrimaryTextColor } from "../style/colors.ts";

export const CenterClass = "flex items-center justify-center";
export const NoOutlineClass = "focus:outline-none focus-visible:outline-none";
export const inputBorderClass = `border-[2px] border-[${DividerBackgroundColor}]`;
export const DividerClass = `h-[0.0625rem] bg-[${DividerBackgroundColor}] my-[1.5rem] w-full`;
export const LinearGradientsClass = "bg-gradient-to-r from-[#FF762C] via-[#FF3A5E] to-[#FF01A9]";
export const InputClass =
    `w-full px-4 py-3 rounded-lg resize-y bg-transparent ${NoOutlineClass} ${inputBorderClass} placeholder-[${PlaceholderColor}] text-[${PrimaryTextColor}] focus:ring-0 focus:ring-[${PrimaryTextColor}] focus:border-[${PrimaryTextColor}] focus:border-[2px] focus:border-solid focus:border-opacity-100`;

export const ButtonClass =
    "rounded px-4 py-2 text-[#F3F4EA] focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed";
export const IconButtonClass =
    `focus:outline-none focus-visible:outline-none rounded-full hover:bg-[#42464D] ${CenterClass}`;
export const KeyboradClass = "px-1 bg-[#2F3136] rounded-sm";
