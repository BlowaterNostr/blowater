import { Configuration } from "https://esm.sh/twind@0.16.16";

export const TWConfig: Configuration = {
    theme: {
        fontFamily: {
            roboto: ["Roboto", "sans-serif"],
        },
        screens: {
            "mobile": { "max": "1023px" },
            "desktop": { "min": "1024px" },
        },
        extend: {
            keyframes: {
                toast: {
                    "0%": { transform: "translateX(0)" },
                    "16.66%": { transform: "translateX(calc(-100% - 1rem))" },
                    "83.34%": { transform: "translateX(calc(-100% - 1rem))" },
                    "100%": { transform: "translateX(0)" },
                },
            },
            animation: {
                "toast": "toast 3s cubic-bezier(0.68, -0.55, 0.25, 1.35)",
            },
        },
    },
    // https://twind.dev/handbook/extended-functionality.html
    // https://sass-lang.com/documentation/style-rules/parent-selector/
    variants: {
        "children": "& > *",
        "firstChild": "& > *:first-child",
        "lastChild": "& > *:last-child",
    },
};
