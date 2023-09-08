/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { Popover, popoverStatus } from "./popover.tsx";

function PopoverTest() {
    const showPopover = () => {
        popoverStatus.value = "Show";
    };

    return (
        <Fragment>
            <button onClick={showPopover}>show</button>

            <Popover
                onClose={() => {
                    console.log("close");
                }}
            >
                <div
                    style={{
                        color: "#fff",
                        textAlign: "center",
                        padding: "5rem",
                    }}
                >
                    Popover
                </div>
            </Popover>
        </Fragment>
    );
}

render(PopoverTest(), document.body);
