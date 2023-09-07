/** @jsx h */
import { ComponentChildren, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { SecondaryBackgroundColor } from "../style/colors.ts";
import { computed, signal } from "https://esm.sh/@preact/signals@1.2.1";

// Model
const popoverStatus = signal<"show" | "hide">("hide");

export function showPopover(onShow?: () => void) {
    popoverStatus.value = "show";
    if (onShow) {
        onShow();
    }
}

export function hidePopover(onHide?: () => void) {
    popoverStatus.value = "hide";
    if (onHide) {
        onHide();
    }
}

function onEscKeyDown(e: h.JSX.TargetedKeyboardEvent<HTMLDivElement>, onHide?: () => void) {
    if ( e.code != "Escape") {
        return;
    }

    hidePopover(onHide);
}

// view
const popoverStyle = {
    container: tw`fixed inset-0 z-20`,
    backdrop: tw`fixed inset-0 z-[-1] backdrop-filter backdrop-blur`,
    childrenContainer: tw`h-[80%] absolute top-[20%] overflow-auto bg-[${SecondaryBackgroundColor}] w-full shadow-lg`,
}

export function Popover(props: {
    children: ComponentChildren,
    onHide?: () => void,
}) {
    const { children, onHide } = props;

    const popoverView = computed(() => (
        popoverStatus.value == "show"
            ?   <div
                    class={popoverStyle.container}
                    onKeyDown={(e) => onEscKeyDown(e, onHide)}
                >
                    <div
                        class={popoverStyle.backdrop}
                        onClick={() => hidePopover(onHide)}
                    >
                    </div>
                    <div
                        class={popoverStyle.childrenContainer}
                    >
                        {children}
                    </div>
                </div>
            : <Fragment></Fragment>
    ));

    return popoverView;
}
