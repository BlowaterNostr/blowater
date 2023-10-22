/** @jsx h */
import { createRef, h, render } from "https://esm.sh/preact@10.17.1";
import { Toast, ToastChannel } from "./toast.tsx";
import { setup, tw } from "https://esm.sh/twind@0.16.16";
import { TWConfig } from "../tw.config.ts";
import { Channel } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";
import { CenterClass, inputBorderClass } from "./tw.ts";

setup(TWConfig);

const toastChannel: ToastChannel = new Channel();
const inputRef = createRef();
render(
    <div class={tw`h-screen w-screen ${CenterClass}`}>
        <input class={tw`${inputBorderClass} px-4 py-2 mr-4`} ref={inputRef} type="text" />
        <button
            onClick={() => {
                toastChannel.put(inputRef.current.value);
            }}
            class={tw`bg-black text-white px-4 py-2 rounded`}
        >
            toast
        </button>
        <Toast inputChan={toastChannel} />
    </div>,
    document.body,
);
