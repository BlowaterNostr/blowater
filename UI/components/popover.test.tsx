/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { Popover } from "./popover.tsx";
import { signal } from "https://esm.sh/@preact/signals@1.2.1";

const show = signal(false);

function PopoverTest() {
    return (
        <Fragment>
            <button
                onClick={() => {
                    show.value = true;
                }}
            >
                Show
            </button>

            {show.value
                ? (
                    <Popover
                        close={() => {
                            show.value = false;
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

                            <input type="text" />
                        </div>
                    </Popover>
                )
                : undefined}
        </Fragment>
    );
}

render(<PopoverTest />, document.body);
