/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { Popover, showPopover } from "./popover.tsx";

function PopoverTest() {
    return (
        <Fragment>
            <button
                onClick={() => {
                    showPopover(() => {
                        console.log("show");
                    });
                }}
            >
                show
            </button>
            {Popover({
                children: <h1>popover simple</h1>,
                onHide: () => {
                    console.log("hide");
                },
            })}
        </Fragment>
    );
}

render(PopoverTest(), document.body);
