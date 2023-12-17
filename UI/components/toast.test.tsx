/** @jsx h */
import { createRef, h, render } from "https://esm.sh/preact@10.17.1";
import { Toast, ToastChannel } from "./toast.tsx";
import { TWConfig } from "../tw.config.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { CenterClass, inputBorderClass } from "./tw.ts";

const toastChannel: ToastChannel = new Channel();
const inputRef = createRef();
render(
    <div class={`h-screen w-screen ${CenterClass}`}>
        <input class={`${inputBorderClass} px-4 py-2 mr-4`} ref={inputRef} type="text" />
        <button
            onClick={() => {
                toastChannel.put(inputRef.current.value);
            }}
            class={`bg-black text-white px-4 py-2 rounded`}
        >
            toast
        </button>
        <Toast inputChan={toastChannel} />
    </div>,
    document.body,
);
