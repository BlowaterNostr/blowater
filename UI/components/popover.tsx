/** @jsx h */
import { ComponentChildren, Fragment, h } from "https://esm.sh/preact@10.17.1";
import { tw } from "https://esm.sh/twind@0.16.16";
import { SecondaryBackgroundColor } from "../style/colors.ts";
import { signal } from "https://esm.sh/@preact/signals@1.2.1";

export const popoverStatus = signal<"Show" | "Hide">("Hide");

export function Popover(props: {
    onClose?: () => void;
    children?: ComponentChildren;
}) {
    const { onClose } = props;

    const styles = {
        container: tw`fixed inset-0 z-20`,
        backdrop: tw`fixed inset-0 z-[-1] backdrop-filter backdrop-blur cursor-pointer`,
        childrenContainer:
            tw`h-[80%] absolute top-[20%] overflow-auto bg-[${SecondaryBackgroundColor}] w-full shadow-inner`,
    };

    const onEscKeyDown = (e: KeyboardEvent) => {
        if (e.code == "Escape") {
            popoverStatus.value = "Hide";

            if (onClose) {
                onClose();
            }
        }
    };

    const onBackdropClick = () => {
        popoverStatus.value = "Hide";

        if (onClose) {
            onClose();
        }
    };

    return (
        <Fragment>
            {popoverStatus.value == "Show"
                ? (
                    <div class={styles.container} onKeyDown={onEscKeyDown}>
                        <div class={styles.backdrop} onClick={onBackdropClick}>
                        </div>
                        <div class={styles.childrenContainer}>
                            {props.children}
                        </div>
                    </div>
                )
                : undefined}
        </Fragment>
    );
}
