/** @jsx h */
import { Fragment, h, render } from "https://esm.sh/preact@10.17.1";
import { Popover, PopoverChan } from "./popover.tsx";
function PopoverTest() {
    return (
        <Fragment>
            <button
                onClick={async () => {
                    await PopoverChan.put({
                        children: (
                            <div
                                style={{
                                    color: "orange",
                                    textAlign: "center",
                                    padding: "5rem",
                                }}
                            >
                                Popover
                                <input type="text" />
                            </div>
                        ),
                        onClose: () => console.log("close"),
                    });
                }}
            >
                Show
            </button>
            <Popover />
        </Fragment>
    );
}

render(<PopoverTest />, document.body);
